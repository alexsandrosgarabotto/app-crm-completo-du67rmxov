# Guia de Deploy e Migração do CRM para VPS com Nginx

Este guia contém o passo a passo completo para publicar este CRM em sua VPS Linux (Ubuntu/Debian), utilizando:
- **Frontend SPA**: Servido estaticamente pelo Nginx em `crm.seudominio.com`
- **Backend PocketBase**: Executando como serviço systemd em `127.0.0.1:8090` e exposto via proxy reverso em `api.seudominio.com`
- **Migração de Dados**: Scripts prontos para levar todos os registros já existentes no ambiente Skip Cloud para a sua VPS.

---

## 📋 Pré-requisitos na VPS

1. Sistema operacional Linux (Ubuntu 22.04/24.04 ou Debian 11/12) com acesso SSH (`root` ou usuário com `sudo`).
2. Nginx instalado e rodando.
3. Node.js 18+ e npm instalados localmente no seu computador (para compilar o frontend e rodar os scripts de exportação/importação).
4. Dois apontamentos DNS configurados no seu gerenciador de domínio:
   - Tipo `A` `crm.seudominio.com` -> IP da VPS
   - Tipo `A` `api.seudominio.com` -> IP da VPS

---

## 🗄️ Passo 1: Instalar o PocketBase na VPS

Acesse a VPS via SSH e execute os comandos:

```bash
# 1. Criar pasta da aplicação PocketBase
sudo mkdir -p /var/www/pocketbase/pb_migrations
sudo mkdir -p /var/www/pocketbase/pb_data

# 2. Baixar a versão mais recente do PocketBase para Linux amd64
cd /tmp
wget https://github.com/pocketbase/pocketbase/releases/download/v0.25.9/pocketbase_0.25.9_linux_amd64.zip
sudo apt-get update && sudo apt-get install -y unzip
unzip pocketbase_0.25.9_linux_amd64.zip
sudo mv pocketbase /var/www/pocketbase/
sudo chmod +x /var/www/pocketbase/pocketbase

# 3. Ajustar permissões para o usuário www-data
sudo chown -R www-data:www-data /var/www/pocketbase
```

---

## ⚙️ Passo 2: Copiar as Migrações e Configurar o Systemd

No seu computador local, você pode copiar os arquivos de migração que definem as coleções e regras do banco (`clients`, `deals`, `tasks`, `products`, `services`, etc.) para a VPS:

### Via PowerShell no Windows:
```powershell
# Enviar as migrações para a VPS (substitua usuario e ip)
scp -r pocketbase/migrations/* usuario@SEU_IP_VPS:/tmp/migrations/

# No terminal da VPS:
sudo mv /tmp/migrations/* /var/www/pocketbase/pb_migrations/
sudo chown -R www-data:www-data /var/www/pocketbase/pb_migrations
```

### Configurar o Serviço Systemd:
Na VPS:
```bash
# Copiar o arquivo deploy/pocketbase.service para o systemd
sudo cp deploy/pocketbase.service /etc/systemd/system/pocketbase.service

# Recarregar os daemons do systemd e habilitar na inicialização
sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase

# Verificar status
sudo systemctl status pocketbase
```

### Criar o Superusuário (Admin) do PocketBase:
```bash
sudo -u www-data /var/www/pocketbase/pocketbase superuser create admin@seudominio.com SuaSenhaForte123 --dir=/var/www/pocketbase/pb_data
```
*(Guarde este email e senha, pois você usará no script de importação de dados e no painel admin `https://api.seudominio.com/_/`)*

---

## 🌐 Passo 3: Configurar o Nginx e Certificados SSL

Copie a configuração de Nginx pronta:

```bash
# Na VPS, copie deploy/nginx.conf para o Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/crm.conf

# Edite o arquivo substituindo os domínios crm.seudominio.com e api.seudominio.com
sudo nano /etc/nginx/sites-available/crm.conf

# Crie o link simbólico para habilitar o site
sudo ln -s /etc/nginx/sites-available/crm.conf /etc/nginx/sites-enabled/

# Teste e recarregue o Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Gerar SSL Gratuito com Certbot (HTTPS):
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.seudominio.com -d api.seudominio.com
```

---

## 📦 Passo 4: Migrar os Dados Já Cadastrados (Exportação & Importação)

Para levar os clientes, negócios, produtos, faturas e configurações que já estão cadastrados:

### 1. No seu computador local, exporte os dados da Skip Cloud:
```powershell
# Instale as dependências se ainda não instalou
npm install

# Execute a exportação (puxa todos os registros das coleções para a pasta data-backup/)
node scripts/export-crm-data.mjs
```
*Se você tiver login e senha de superuser da instância de origem, passe como parâmetros:*
```powershell
node scripts/export-crm-data.mjs https://app-crm-completo-7ca4b.shrd01.internal.goskip.dev seu_email sua_senha
```
Os arquivos JSON serão gerados na pasta `data-backup/`.

### 2. Importe os dados para a sua nova VPS:
Execute o script apontando para a sua VPS com o superuser criado no **Passo 2**:
```powershell
node scripts/import-crm-data.mjs https://api.seudominio.com admin@seudominio.com SuaSenhaForte123
```
- Este script é **idempotente** (pode ser executado várias vezes sem duplicar dados).
- Ele **preserva os IDs originais**, garantindo que as relações entre clientes, negociações (deals), faturas (invoices) e tarefas permaneçam íntegras.
- Para registros da coleção `users`, se não houver senha no backup, define a senha temporária `MudarSenha@123` para que eles possam redefinir depois.

---

## 💻 Passo 5: Compilar o Frontend e Enviar para a VPS

No seu computador local, gere a build de produção configurando a variável `VITE_POCKETBASE_URL` para apontar para o seu backend na VPS:

### No Windows (PowerShell):
```powershell
# 1. Definir a URL da sua API PocketBase e compilar
$env:VITE_POCKETBASE_URL="https://api.seudominio.com"
npm run build

# 2. Criar a pasta de destino na VPS
ssh usuario@SEU_IP_VPS "sudo mkdir -p /var/www/crm/dist && sudo chown -R \$USER:\$USER /var/www/crm"

# 3. Enviar os arquivos compilados (pasta dist/)
scp -r dist/* usuario@SEU_IP_VPS:/var/www/crm/dist/

# 4. Ajustar permissões na VPS para o Nginx poder ler
ssh usuario@SEU_IP_VPS "sudo chown -R www-data:www-data /var/www/crm/dist && sudo chmod -R 755 /var/www/crm/dist"
```

---

## 🔒 Passo 6: Ajustes de Segurança e CORS no PocketBase

1. Acesse o painel administrativo do PocketBase da VPS em `https://api.seudominio.com/_/`
2. Entre com o email e senha do superusuário.
3. Em **Settings > Application**:
   - Defina a **Application URL**: `https://api.seudominio.com`
4. Em **Settings > Mail settings**:
   - Configure o seu servidor SMTP (ex.: Amazon SES, Sendgrid, Resend ou SMTP próprio) para envio de emails de recuperação de senha e convites de novos membros da equipe.
5. Os cabeçalhos de CORS no PocketBase aceitam requisições vindas de qualquer origem por padrão ou você pode restringir se desejar. Como o Nginx está atuando como proxy reverso, requisições diretas de `crm.seudominio.com` para `api.seudominio.com` funcionarão perfeitamente com os devidos cabeçalhos de autorização do PocketBase.

---

## 🔄 Atualizações Futuras

Sempre que fizer alterações no CRM e quiser atualizar sua VPS:

```powershell
# No computador local:
$env:VITE_POCKETBASE_URL="https://api.seudominio.com"
npm run build
scp -r dist/* usuario@SEU_IP_VPS:/var/www/crm/dist/
```

Pronto! Seu CRM completo e independente estará rodando em sua própria VPS com total performance, dados preservados e segurança SSL.
