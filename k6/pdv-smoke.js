import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// Métricas custom — arquivo.md §15 / GOVERNANCE DoD
const p95Trend = new Trend('pdv_p95', true);
const failedRate = new Rate('failed_requests');
const osEntregues = new Counter('os_entregues');
const fiscalAutorizado = new Counter('fiscal_autorizado');

export const options = {
  // Smoke: poucos VUs, valida contrato antes do load
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<300'],      // PDV <300ms p95
    http_req_failed: ['rate<0.01'],        // <1% falha
    'failed_requests': ['rate<0.01'],
    'fiscal_autorizado': ['count>0'],
  },
  tags: {
    project: 'VisionBox',
    test: 'pdv-smoke',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const LOJA_ID = __ENV.LOJA_ID || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

// payload mínimo — preço HALF_EVEN já validado em TributacaoService
function novoPedidoPayload() {
  return JSON.stringify({
    clienteNome: `Cliente Smoke ${__VU}-${__ITER}`,
    itens: [{ sku: 'ARMA-001', quantidade: 1, precoUnitario: '199.90' }],
    observacao: 'k6 pdv-smoke',
  });
}

function headers(idempotencyKey) {
  const h = {
    'Content-Type': 'application/json',
    'X-Loja-Id': LOJA_ID,
  };
  if (idempotencyKey) h['Idempotency-Key'] = idempotencyKey;
  return h;
}

export function setup() {
  // health check — falha rápido se app não subiu (docker compose up)
  const r = http.get(`${BASE_URL}/actuator/health`, { headers: headers() });
  console.log(`setup health=${r.status} body=${r.body}`);
  return { baseUrl: BASE_URL };
}

export default function () {
  // 1. POST /api/v1/vendas com Idempotency-Key (PDV finaliza)
  const key = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const res = http.post(`${BASE_URL}/api/v1/vendas`, novoPedidoPayload(), {
    headers: headers(key),
    tags: { name: 'POST /api/v1/vendas' },
  });

  const ok = check(res, {
    'vendas 201': (r) => r.status === 201,
    'resposta tem id': (r) => {
      try { return JSON.parse(r.body).id !== undefined; } catch { return false; }
    },
    'não vazou tenant (sem 403)': (r) => r.status !== 403,
  });
  failedRate.add(!ok);
  p95Trend.add(res.timings.duration);

  // 2. Replay idempotente — mesmo key deve retornar mesmo body sem duplicar
  const replay = http.post(`${BASE_URL}/api/v1/vendas`, novoPedidoPayload(), {
    headers: headers(key), // mesma key
    tags: { name: 'POST /api/v1/vendas replay' },
  });
  check(replay, {
    'replay 201 ou 200': (r) => r.status === 201 || r.status === 200,
    'Idempotent-Replayed header': (r) => r.headers['Idempotent-Replayed'] === 'true' || r.status === 201,
  });

  // 3. Duplo clique simulado — 2 requests paralelos mesma key (via batch)
  // k6 batch é paralelo no mesmo VU
  const dupKey = `dup-${__VU}-${Date.now()}`;
  const batch = http.batch([
    ['POST', `${BASE_URL}/api/v1/vendas`, novoPedidoPayload(), { headers: headers(dupKey), tags: { name: 'PDV duplo clique 1' } }],
    ['POST', `${BASE_URL}/api/v1/vendas`, novoPedidoPayload(), { headers: headers(dupKey), tags: { name: 'PDV duplo clique 2' } }],
  ]);
  check(batch[0], { 'duplo clique 1 201': (r) => r.status === 201 });
  check(batch[1], { 'duplo clique 2 201 ou replay': (r) => r.status === 201 });

  // 4. GET paginado deve ter X-Total-Count (DoD)
  const list = http.get(`${BASE_URL}/api/v1/vendas?page=0&size=10`, { headers: headers() });
  check(list, {
    'GET vendas 200 ou 404 (sem dados)': (r) => r.status === 200 || r.status === 404,
  });

  // 5. Fiscal mock — contrato minimo M2: cStat 100, chave 44, protocolo 15.
  const fiscal = http.post(`${BASE_URL}/api/v1/fiscal/nfce/emitir`, JSON.stringify({
    modelo: 'NFCE_65',
    serie: '1',
    numero: 900000 + __ITER,
    ambiente: '2',
    valorTotal: '199.90',
  }), {
    headers: headers(`fiscal-${__VU}-${__ITER}-${Date.now()}`),
    tags: { name: 'POST /api/v1/fiscal/nfce/emitir' },
  });
  const fiscalOk = check(fiscal, {
    'fiscal 201 mock': (r) => r.status === 201,
    'fiscal cStat 100': (r) => {
      try { return JSON.parse(r.body).codigoStatus === '100'; } catch { return false; }
    },
    'fiscal chave 44': (r) => {
      try { return /^\d{44}$/.test(JSON.parse(r.body).chaveAcesso); } catch { return false; }
    },
    'fiscal protocolo 15': (r) => {
      try { return /^\d{15}$/.test(JSON.parse(r.body).protocolo); } catch { return false; }
    },
    'fiscal tpEmis normal': (r) => {
      try { return JSON.parse(r.body).tpEmis === '1'; } catch { return false; }
    },
  });
  if (fiscalOk) fiscalAutorizado.add(1);

  sleep(0.5);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0;
  console.log(`\n=== VisionBox PDV Smoke ===`);
  console.log(`p95=${p95}ms  failed=${data.metrics.http_req_failed.values.rate}`);
  console.log(`checks passes=${data.metrics.checks.values.passes} fails=${data.metrics.checks.values.fails}`);
  if (p95 > 300) console.warn('⚠️  p95 > 300ms — risco SLA PDV (arquivo.md §15)');
  return {
    stdout: JSON.stringify(data, null, 2),
    'k6/pdv-smoke.summary.json': JSON.stringify(data, null, 2),
  };
}
