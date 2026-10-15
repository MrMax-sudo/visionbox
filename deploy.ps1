[CmdletBinding()]
param(
    [Alias("m")]
    [Parameter(Position=0)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host "`n>> [VisionBox Deploy] Iniciando fluxo de deploy..." -ForegroundColor Cyan

# 1. Checa status do git local
$status = git status --porcelain
if ($status) {
    if (-not $Message) {
        $Message = Read-Host "Ha alteracoes locais pendentes. Digite a mensagem de commit (ou ENTER para cancelar)"
        if (-not $Message) {
            Write-Host "Deploy cancelado: existem alteracoes locais pendentes." -ForegroundColor Yellow
            exit 1
        }
    }
    Write-Host "Comitando alteracoes locais..." -ForegroundColor Green
    git add .
    git commit -m "$Message"
} else {
    Write-Host "Nenhuma alteracao local pendente para commit." -ForegroundColor Green
}

# 2. Push para o GitHub
Write-Host "Enviando atualizacoes para o GitHub (origin main)..." -ForegroundColor Green
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha no git push para o GitHub." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Execucao remota na VPS via SSH
Write-Host "`nConectando a VPS e aplicando atualizacoes..." -ForegroundColor Cyan

$remoteCmd = "cd /home/mrmax/PROJETOS/VisionBox && echo '=== VPS: Git pull ===' && git pull origin main && echo '=== VPS: Rebuilding containers ===' && docker compose up -d --build app web && echo '=== VPS: Limpando imagens dangling ===' && docker image prune -f && echo '=== VPS: Status ===' && docker compose ps"

ssh -o BatchMode=yes -o ConnectTimeout=10 mrmax@192.168.15.90 $remoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nErro durante a execucao do deploy na VPS." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n>> [VisionBox Deploy] Finalizado com sucesso!" -ForegroundColor Green
