// Nome do responsável/empresa exibido na política de privacidade.
// Edite esta constante (e a de contato, se necessário) para atualizar a página.
const EMPRESA_NOME = 'Alex'
const WHATSAPP_CONTATO = '+55 66 9973-3422'
const WHATSAPP_LINK = 'https://wa.me/556699733422'
const ULTIMA_ATUALIZACAO = '9 de novembro de 2026'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
)

const PrivacyPolicyPage = () => (
  <div className="min-h-screen bg-background">
    <main className="mx-auto w-full max-w-[720px] px-6 py-12 sm:py-16">
      <header className="space-y-2 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Política de Privacidade
        </h1>
        <p className="text-sm text-muted-foreground">Última atualização: {ULTIMA_ATUALIZACAO}</p>
      </header>

      <div className="space-y-10 pt-8">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Esta Política de Privacidade descreve como{' '}
          <strong className="text-foreground">{EMPRESA_NOME}</strong> ("nós", "nosso") coleta, usa,
          armazena e protege os dados pessoais tratados por meio do nosso sistema de CRM, que
          utiliza o WhatsApp Business Cloud API da Meta para comunicação com clientes.
        </p>

        <Section title="1. Dados que coletamos">
          <p>Podemos coletar e armazenar os seguintes dados:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nome do cliente e do contato;</li>
            <li>Número de telefone (WhatsApp);</li>
            <li>Endereço de e-mail;</li>
            <li>
              Mensagens trocadas pelo WhatsApp (recebidas e enviadas), para histórico de
              atendimento;
            </li>
            <li>
              Dados de vendas, ordens de serviço e informações financeiras registrados pelo próprio
              usuário do CRM sobre seus clientes.
            </li>
          </ul>
        </Section>

        <Section title="2. Como usamos os dados">
          <p>Os dados coletados são utilizados exclusivamente para:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Atendimento ao cliente por meio do WhatsApp;</li>
            <li>Gestão de clientes, vendas e financeiro dentro do CRM;</li>
            <li>
              Resposta automática a mensagens recebidas pelo WhatsApp, agilizando o primeiro
              contato.
            </li>
          </ul>
          <p>Não utilizamos os dados para nenhuma finalidade além das descritas nesta política.</p>
        </Section>

        <Section title="3. Mensagens do WhatsApp">
          <p>
            As mensagens recebidas pelo WhatsApp chegam ao nosso sistema por meio do webhook oficial
            da Meta (WhatsApp Business Cloud API) e são armazenadas no CRM para compor o histórico
            de atendimento ao cliente. A Meta também trata esses dados conforme as suas próprias
            políticas de privacidade e os termos do WhatsApp Business.
          </p>
        </Section>

        <Section title="4. Compartilhamento de dados">
          <p>
            Os dados <strong className="text-foreground">não são vendidos</strong> nem
            compartilhados com terceiros para fins de marketing. O compartilhamento ocorre apenas
            com os provedores estritamente necessários à operação do serviço:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Meta Platforms, Inc. (WhatsApp Business Cloud API);</li>
            <li>Provedores de hospedagem e infraestrutura do sistema.</li>
          </ul>
        </Section>

        <Section title="5. Direitos do titular (LGPD)">
          <p>
            Nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), o titular
            dos dados pode solicitar a qualquer momento:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Acesso aos dados pessoais que tratamos;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Exclusão dos dados pessoais tratados com base no consentimento.</li>
          </ul>
          <p>
            Para exercer esses direitos, basta entrar em contato pelo canal informado na seção de
            contato abaixo. Atendemos as solicitações no menor prazo possível.
          </p>
        </Section>

        <Section title="6. Contato">
          <p>
            Em caso de dúvidas sobre esta política ou para exercer seus direitos, entre em contato
            com <strong className="text-foreground">{EMPRESA_NOME}</strong>:
          </p>
          <p>
            WhatsApp:{' '}
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-4"
            >
              {WHATSAPP_CONTATO}
            </a>
          </p>
        </Section>
      </div>

      <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        <p>
          {EMPRESA_NOME} — Sistema de CRM ·{' '}
          <a href="/" className="font-medium text-primary underline underline-offset-4">
            Voltar para a página inicial
          </a>
        </p>
      </footer>
    </main>
  </div>
)

export default PrivacyPolicyPage
