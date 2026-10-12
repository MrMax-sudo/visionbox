package com.visionbox.modules.pessoa.service;

import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.dto.ClienteRequest;
import com.visionbox.modules.pessoa.dto.ClienteResponse;
import com.visionbox.modules.pessoa.mapper.ClienteMapper;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.shared.crypto.CryptoService;
import com.visionbox.shared.dto.ImportacaoResultado;
import com.visionbox.shared.tenant.TenantContext;
import com.visionbox.shared.validation.CpfValidator;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClienteService {

    private final ClienteRepository repository;
    private final ClienteMapper mapper;
    private final CryptoService cryptoService;

    @Transactional(readOnly = true)
    public Page<ClienteResponse> listar(String nome, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Page<Cliente> page;
        if (nome != null && !nome.isBlank()) {
            page = repository.findByLojaIdAndNomeContainingIgnoreCase(lojaId, nome.trim(), pageable);
        } else {
            page = repository.findAllByLojaId(lojaId, pageable);
        }
        return page.map(this::toMaskedResponse);
    }

    @Transactional(readOnly = true)
    public ClienteResponse buscarPorId(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Cliente c = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado"));
        return toMaskedResponse(c);
    }

    @Transactional
    public ClienteResponse criar(ClienteRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        validarNome(req.getNome());
        String cpfHash = null;
        byte[] cpfCipher = null;
        String cpfDigits = null;
        if (req.getCpf() != null && !req.getCpf().isBlank()) {
            cpfDigits = normalize(req.getCpf());
            validarCpf(cpfDigits);
            cpfHash = cryptoService.hash(cpfDigits);
            if (repository.existsByCpfHashAndLojaId(cpfHash, lojaId)) {
                throw new IllegalArgumentException("CPF já cadastrado nesta loja");
            }
            cpfCipher = cryptoService.encrypt(cpfDigits);
        }
        Cliente entity = Cliente.builder()
                .lojaId(lojaId)
                .nome(req.getNome().trim())
                .cpfCipher(cpfCipher)
                .cpfHash(cpfHash)
                .telefone(req.getTelefone())
                .whatsapp(req.getWhatsapp())
                .email(req.getEmail())
                .dataNascimento(parseDate(req.getDataNascimento()))
                .cep(sanitizeCep(req.getCep()))
                .logradouro(req.getLogradouro())
                .numero(req.getNumero())
                .complemento(req.getComplemento())
                .bairro(req.getBairro())
                .cidade(req.getCidade())
                .uf(req.getUf() != null ? req.getUf().toUpperCase() : null)
                .consentimentoRecall(Boolean.TRUE.equals(req.getConsentimentoRecall()))
                .canalPreferido(req.getCanalPreferido() != null ? req.getCanalPreferido() : "WHATSAPP")
                .build();
        entity = repository.save(entity);
        return toMaskedResponse(entity);
    }

    @Transactional
    public ClienteResponse atualizar(UUID id, ClienteRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Cliente c = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado"));
        if (req.getNome() != null) {
            validarNome(req.getNome());
            c.setNome(req.getNome().trim());
        }
        if (req.getCpf() != null) {
            if (req.getCpf().isBlank()) {
                c.setCpfCipher(null);
                c.setCpfHash(null);
            } else {
                String digits = normalize(req.getCpf());
                validarCpf(digits);
                String hash = cryptoService.hash(digits);
                // se mudar CPF verifica duplicidade
                if (!hash.equals(c.getCpfHash()) && repository.existsByCpfHashAndLojaId(hash, lojaId)) {
                    throw new IllegalArgumentException("CPF já cadastrado nesta loja");
                }
                c.setCpfCipher(cryptoService.encrypt(digits));
                c.setCpfHash(hash);
            }
        }
        if (req.getTelefone() != null) c.setTelefone(req.getTelefone());
        if (req.getWhatsapp() != null) c.setWhatsapp(req.getWhatsapp());
        if (req.getEmail() != null) c.setEmail(req.getEmail());
        if (req.getDataNascimento() != null) c.setDataNascimento(parseDate(req.getDataNascimento()));
        if (req.getCep() != null) c.setCep(sanitizeCep(req.getCep()));
        if (req.getLogradouro() != null) c.setLogradouro(req.getLogradouro());
        if (req.getNumero() != null) c.setNumero(req.getNumero());
        if (req.getComplemento() != null) c.setComplemento(req.getComplemento());
        if (req.getBairro() != null) c.setBairro(req.getBairro());
        if (req.getCidade() != null) c.setCidade(req.getCidade());
        if (req.getUf() != null) c.setUf(req.getUf().toUpperCase());
        if (req.getConsentimentoRecall() != null) c.setConsentimentoRecall(req.getConsentimentoRecall());
        if (req.getCanalPreferido() != null) c.setCanalPreferido(req.getCanalPreferido());
        repository.save(c);
        return toMaskedResponse(c);
    }

    @Transactional
    public void remover(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Cliente c = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado"));
        c.setAtivo(false);
        repository.save(c);
    }

    private ClienteResponse toMaskedResponse(Cliente c) {
        String masked = null;
        if (c.getCpfCipher() != null) {
            try {
                String plain = cryptoService.decrypt(c.getCpfCipher());
                masked = cryptoService.mask(plain);
            } catch (Exception e) {
                masked = "***.***.***-**";
            }
        } else if (c.getCpfHash() != null) {
            masked = "***.***.***-**";
        }
        return mapper.toResponseWithMask(c, masked);
    }

    private static String normalize(String cpf) {
        return cpf.replaceAll("\\D", "");
    }

    private static void validarCpf(String digits) {
        // delega para validador compartilhado com dígito verificador (LGPD/ADR-002)
        CpfValidator.validateOrThrow(digits);
    }

    private static void validarNome(String nome) {
        if (nome == null || nome.trim().length() < 2) throw new IllegalArgumentException("Nome deve ter ao menos 2 caracteres");
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        return LocalDate.parse(s.trim());
    }

    private static String sanitizeCep(String cep) {
        if (cep == null) return null;
        String d = cep.replaceAll("\\D", "");
        return d.isEmpty() ? null : d;
    }

    @Transactional
    public ImportacaoResultado importarCsv(MultipartFile file) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Arquivo vazio ou ausente");
        }

        List<String> erros = new ArrayList<>();
        int processados = 0;
        int totalLinhas = 0;

        try {
            List<List<String>> linhas = com.visionbox.shared.util.PlanilhaImportHelper.extrairLinhas(file);
            boolean firstLine = true;

            for (List<String> cols : linhas) {
                if (cols.isEmpty()) continue;
                totalLinhas++;

                // Pula cabeçalho se contiver "nome" ou "cpf"
                String primeiraCol = cols.get(0).toLowerCase();
                String segundaCol = cols.size() > 1 ? cols.get(1).toLowerCase() : "";
                if (firstLine && (primeiraCol.contains("nome") || primeiraCol.contains("cpf") || segundaCol.contains("cpf"))) {
                    firstLine = false;
                    continue;
                }
                firstLine = false;

                if (cols.size() < 2 || cols.get(0).isBlank()) {
                    erros.add("Linha " + totalLinhas + ": Formato inválido. Esperado no mínimo: Nome do Cliente e Telefone ou CPF");
                    continue;
                }

                try {
                    String nome = cols.get(0).trim();
                    validarNome(nome);

                    String cpfRaw = cols.size() > 1 && !cols.get(1).isBlank() ? cols.get(1).trim() : null;
                    String telefone = cols.size() > 2 && !cols.get(2).isBlank() ? cols.get(2).trim() : null;
                    String email = cols.size() > 3 && !cols.get(3).isBlank() ? cols.get(3).trim() : null;
                    String cep = cols.size() > 4 && !cols.get(4).isBlank() ? sanitizeCep(cols.get(4).trim()) : null;
                    String cidade = cols.size() > 5 && !cols.get(5).isBlank() ? cols.get(5).trim() : null;
                    String uf = cols.size() > 6 && !cols.get(6).isBlank() ? cols.get(6).trim().toUpperCase() : null;

                    String cpfHash = null;
                    byte[] cpfCipher = null;
                    if (cpfRaw != null && !cpfRaw.isBlank()) {
                        String digits = normalize(cpfRaw);
                        if (digits.length() == 11) {
                            cpfHash = cryptoService.hash(digits);
                            cpfCipher = cryptoService.encrypt(digits);
                            if (repository.existsByCpfHashAndLojaId(cpfHash, lojaId)) {
                                // Atualiza dados se já existe
                                Cliente exist = repository.findByCpfHashAndLojaId(cpfHash, lojaId).orElse(null);
                                if (exist != null) {
                                    exist.setNome(nome);
                                    if (telefone != null) exist.setTelefone(telefone);
                                    if (email != null) exist.setEmail(email);
                                    if (cep != null) exist.setCep(cep);
                                    if (cidade != null) exist.setCidade(cidade);
                                    if (uf != null) exist.setUf(uf);
                                    repository.save(exist);
                                    processados++;
                                    continue;
                                }
                            }
                        }
                    }

                    Cliente c = Cliente.builder()
                            .lojaId(lojaId)
                            .nome(nome)
                            .cpfHash(cpfHash)
                            .cpfCipher(cpfCipher)
                            .telefone(telefone)
                            .whatsapp(telefone)
                            .email(email)
                            .cep(cep)
                            .cidade(cidade)
                            .uf(uf)
                            .consentimentoRecall(true)
                            .build();

                    repository.save(c);
                    processados++;
                } catch (Exception e) {
                    erros.add("Linha " + totalLinhas + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Erro ao importar planilha de clientes: {}", e.getMessage());
            erros.add("Falha ao ler arquivo: " + e.getMessage());
        }

        return ImportacaoResultado.sucesso(totalLinhas, processados, erros);
    }

    public byte[] exportarModeloClientes(String formato) throws java.io.IOException {
        List<String> cabecalhos = List.of("Nome do Cliente", "CPF", "Telefone", "Email", "CEP", "Cidade", "UF");
        List<List<String>> exemplos = List.of(
                List.of("Ana Paula Souza", "123.456.789-00", "(11) 98765-4321", "ana.souza@email.com", "01310-100", "São Paulo", "SP"),
                List.of("Carlos Eduardo Lima", "987.654.321-99", "(21) 99876-5432", "carlos.lima@email.com", "20040-002", "Rio de Janeiro", "RJ")
        );

        if ("xlsx".equalsIgnoreCase(formato) || "excel".equalsIgnoreCase(formato)) {
            return com.visionbox.shared.util.PlanilhaImportHelper.gerarModeloExcel("Clientes", cabecalhos, exemplos);
        } else {
            return com.visionbox.shared.util.PlanilhaImportHelper.gerarModeloCsv(cabecalhos, exemplos);
        }
    }
}
