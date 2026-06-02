/**
 * Legal documents shown in the app. Each has a version so we can track exactly
 * which version the customer accepted (see consent history).
 *
 * ⚠️ Estes textos são uma base inicial e devem ser revisados pelo jurídico da
 * empresa antes da publicação oficial.
 */
export type LegalDocKey = "termos_uso" | "privacidade_lgpd" | "confidencialidade";

export type LegalDoc = {
  key: LegalDocKey;
  title: string;
  short: string;
  version: string;
  updatedAt: string; // dd/mm/aaaa
  body: string;
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    key: "termos_uso",
    title: "Termos de Uso",
    short: "Regras de uso do aplicativo e dos serviços GO",
    version: "1.0",
    updatedAt: "01/06/2026",
    body: `1. Aceitação
Ao utilizar o aplicativo GO, você concorda com estes Termos de Uso. Caso não concorde, não utilize o aplicativo.

2. Serviços
O GO oferece rastreamento e monitoramento de bens (veículos, pets, equipamentos e outros), além de funcionalidades como cerca eletrônica, alertas, bloqueio remoto (quando aplicável) e acionamento de emergência.

3. Conta do usuário
Você é responsável por manter a confidencialidade das suas credenciais e por todas as atividades realizadas na sua conta. Informe-nos imediatamente sobre qualquer uso não autorizado.

4. Uso adequado
É proibido usar o app para finalidades ilícitas, monitorar terceiros sem consentimento, ou de forma que viole a legislação vigente.

5. Bloqueio remoto
O bloqueio de veículos deve ser usado com responsabilidade. Nunca bloqueie um veículo em movimento. Cada comando é registrado com data, hora e IP.

6. Disponibilidade
Empregamos os melhores esforços para manter o serviço disponível, mas não garantimos funcionamento ininterrupto, dependente de fatores como rede móvel, GPS e energia do rastreador.

7. Alterações
Estes Termos podem ser atualizados. A versão vigente estará sempre disponível no aplicativo, com a data de atualização.

8. Contato
Em caso de dúvidas, utilize a Central de Ajuda no aplicativo.`,
  },
  {
    key: "privacidade_lgpd",
    title: "Política de Privacidade (LGPD)",
    short: "Como tratamos seus dados pessoais conforme a LGPD",
    version: "1.0",
    updatedAt: "01/06/2026",
    body: `Esta Política descreve como o GO trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).

1. Dados que coletamos
• Cadastro: nome, e-mail, e dados de contato.
• Localização: posição e telemetria dos bens rastreados.
• Uso: registros de acesso, dispositivo e endereço IP.

2. Finalidades
Utilizamos seus dados para prestar o serviço de rastreamento, enviar alertas, garantir segurança, prevenir fraudes e cumprir obrigações legais.

3. Base legal
O tratamento se baseia na execução do contrato, no cumprimento de obrigações legais, no legítimo interesse e no seu consentimento, quando aplicável.

4. Compartilhamento
Podemos compartilhar dados com prestadores de serviço (ex.: nuvem, mapas) e autoridades, quando exigido por lei. Não vendemos seus dados.

5. Localização
Os dados de localização são usados exclusivamente para as funcionalidades de rastreamento e segurança que você ativa.

6. Seus direitos
Você pode acessar, corrigir, portar e excluir seus dados, além de revogar consentimentos. A exclusão da conta remove seus dados (Perfil → Excluir minha conta).

7. Segurança
Adotamos medidas técnicas e organizacionais para proteger seus dados (criptografia em trânsito, controle de acesso e registros de auditoria).

8. Retenção
Mantemos os dados pelo tempo necessário às finalidades e obrigações legais. Depois disso, são eliminados ou anonimizados.

9. Encarregado (DPO)
Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale conosco pela Central de Ajuda.`,
  },
  {
    key: "confidencialidade",
    title: "Termo de Confidencialidade",
    short: "Compromisso de sigilo sobre seus dados",
    version: "1.0",
    updatedAt: "01/06/2026",
    body: `1. Compromisso
O GO compromete-se a manter sigilo sobre as informações pessoais, de localização e de uso fornecidas por você, tratando-as com confidencialidade.

2. Acesso restrito
O acesso às suas informações é restrito a colaboradores e sistemas estritamente necessários à prestação do serviço, sob dever de sigilo.

3. Localização sensível
As informações de localização dos seus bens são consideradas sensíveis e protegidas contra acesso não autorizado.

4. Não divulgação
Não divulgamos suas informações a terceiros sem a sua autorização, exceto por determinação legal ou para a prestação do serviço contratado.

5. Vigência
Este compromisso de confidencialidade permanece válido durante e após a vigência da sua relação com o GO, observados os prazos legais.

6. Incidentes
Em caso de incidente de segurança que possa acarretar risco aos seus direitos, comunicaremos você e a autoridade competente, conforme a LGPD.`,
  },
];

export function getLegalDoc(key: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.key === key);
}

export const CONSENT_LABEL: Record<string, string> = {
  termos_uso: "Termos de Uso",
  privacidade_lgpd: "Política de Privacidade (LGPD)",
  confidencialidade: "Termo de Confidencialidade",
};
