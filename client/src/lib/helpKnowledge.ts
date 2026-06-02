/**
 * Knowledge base for the GO help assistant.
 *
 * Runs entirely on-device (no LLM API cost) using keyword matching. It's
 * "fed" over time by (a) expanding these entries and (b) reviewing the real
 * questions users ask that didn't match (logged via help.logQuery), so the
 * assistant gets progressively more helpful and welcoming.
 */
export type HelpEntry = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
};

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "rastrear",
    title: "Como rastrear / ver no mapa",
    keywords: ["rastrear", "rastreio", "localizar", "mapa", "onde", "localizacao", "ver", "posicao", "acompanhar"],
    answer:
      "Para ver onde está seu equipamento:\n1. Toque em **Rastrear** na barra inferior (ou em **Ver no mapa** no card da Início).\n2. O mapa mostra a posição em tempo real.\n3. Toque no ícone no mapa para ver os detalhes (status, bateria, velocidade).\n\nDica: tem mais de um equipamento? Toque em **Todos** para ver tudo no mesmo mapa. 🗺️",
  },
  {
    id: "bloquear",
    title: "Como bloquear / desbloquear",
    keywords: ["bloquear", "bloqueio", "desbloquear", "desligar", "imobilizar", "trancar"],
    answer:
      "Para bloquear ou desbloquear o veículo:\n1. Na Início, toque em **Bloquear** (ações rápidas).\n2. Leia e aceite o **termo de responsabilidade**.\n3. Confirme a ação.\n\n⚠️ Por segurança, evite bloquear com o veículo em movimento. Todo comando fica registrado no histórico.",
  },
  {
    id: "cerca",
    title: "Cerca eletrônica (geofence)",
    keywords: ["cerca", "geofence", "area", "zona", "perimetro", "regiao", "eletronica"],
    answer:
      "A cerca eletrônica avisa quando o equipamento entra ou sai de uma área:\n1. Início → **Cerca**.\n2. Toque em **+** e depois no mapa para definir o centro.\n3. Ajuste o raio, dê um nome e salve.\n\nVocê recebe um alerta sempre que houver entrada/saída. 📍",
  },
  {
    id: "sos",
    title: "Botão SOS / emergência",
    keywords: ["sos", "emergencia", "socorro", "ajuda", "guincho", "acidente", "pane", "assistencia"],
    answer:
      "Em uma emergência:\n1. Toque no botão **SOS** (centro da barra inferior).\n2. **Segure** o botão até confirmar (evita acionamento acidental).\n3. Sua localização é capturada e enviada à Central.\n\nVocê pode cancelar em até 10s e avisar contatos de emergência com 1 toque. 🆘",
  },
  {
    id: "compartilhar",
    title: "Compartilhar localização",
    keywords: ["compartilhar", "link", "enviar", "localizacao", "whatsapp", "compartilhamento"],
    answer:
      "Para compartilhar a localização por um link temporário:\n1. Início → **Compartilhar**.\n2. Escolha a duração (1h a 48h) e gere o link.\n3. Envie pelo WhatsApp ou copie o link.\n\nVocê pode revogar o link a qualquer momento. 🔗",
  },
  {
    id: "furto",
    title: "Comunicar furto ou roubo",
    keywords: ["furto", "roubo", "roubaram", "levaram", "ocorrencia", "boletim"],
    answer:
      "Se o veículo foi furtado/roubado:\n1. Início → **Furto**.\n2. Siga o passo a passo guiado.\n3. A Central é acionada automaticamente.\n\nMantenha a calma — estamos com você. 🚨",
  },
  {
    id: "push",
    title: "Ativar notificações",
    keywords: ["notificacao", "notificacoes", "push", "alerta", "alertas", "avisar", "aviso"],
    answer:
      "Para receber alertas (bateria, velocidade, cerca):\n1. Perfil → **Notificações** → **Ativar**.\n2. Aceite a permissão.\n\n📱 No iPhone, primeiro **adicione o GO à Tela de Início** (Safari → Compartilhar → Adicionar à Tela de Início) e abra pelo ícone. Depois ative as notificações.",
  },
  {
    id: "demo",
    title: "Modo demonstração",
    keywords: ["demo", "demonstracao", "teste", "exemplo", "simulado"],
    answer:
      "O modo demonstração mostra equipamentos de exemplo (um carro andando, um pet e uma guitarra) para você conhecer o app:\n1. Perfil → **Modo demonstração** → ativar.\n2. Veja em **Rastrear** o carro se movendo.\n\nPara desligar, é só desativar no Perfil. ✨",
  },
  {
    id: "trocar",
    title: "Trocar de equipamento",
    keywords: ["trocar", "selecionar", "mudar", "equipamento", "veiculo", "alternar", "escolher"],
    answer:
      "Tem mais de um equipamento? Na tela **Início**, toque nos **chips** no topo (com o ícone e o nome) para alternar entre eles. O card e o mapa mudam na hora. Em **Gerenciar** você vê a lista completa. 🚗🐕🎸",
  },
  {
    id: "icone",
    title: "Mudar o ícone do equipamento",
    keywords: ["icone", "tipo", "pet", "cachorro", "moto", "caminhao", "guitarra", "personalizar", "imagem"],
    answer:
      "Para mudar o ícone (carro, moto, pet, instrumento…):\n1. Início → **Gerenciar** (ou aba Equipamentos).\n2. Toque em **Editar** → botão **Ícone** no equipamento.\n3. Escolha o que melhor representa seu bem.\n\nO ícone novo aparece no mapa e nos cards. 🎨",
  },
  {
    id: "velocidade",
    title: "Limite de velocidade",
    keywords: ["velocidade", "limite", "kmh", "excesso", "correndo", "rapido"],
    answer:
      "Para definir o limite de velocidade (e receber alerta ao ultrapassar):\n1. Selecione o veículo na Início.\n2. Perfil → **Limite de velocidade**.\n3. Ajuste e salve.\n\nVale para veículos — o alerta chega por notificação. ⚡",
  },
  {
    id: "pagamento",
    title: "Pagamento e faturas",
    keywords: ["pagamento", "pagar", "fatura", "boleto", "pix", "cartao", "2 via", "segunda via", "mensalidade"],
    answer:
      "Para gerenciar pagamentos:\n• Perfil → **Pagamento**: troque a forma (boleto, PIX, cartão).\n• Perfil → **Faturas**: veja o histórico e a 2ª via do boleto.\n\n💳",
  },
  {
    id: "historico",
    title: "Histórico de trajetos",
    keywords: ["historico", "trajeto", "viagem", "viagens", "percurso", "rota", "onde andou"],
    answer:
      "Para ver por onde o veículo passou:\n1. Início → **Histórico**.\n2. Escolha uma viagem para ver o trajeto no mapa.\n\nVocê pode filtrar por data. 🛣️",
  },
  {
    id: "excluir",
    title: "Excluir minha conta",
    keywords: ["excluir", "apagar", "deletar", "conta", "remover", "cancelar conta", "lgpd"],
    answer:
      "Para excluir sua conta e todos os dados:\n1. Perfil → role até o fim → **Excluir minha conta**.\n2. Confirme.\n\n⚠️ Esta ação é permanente e remove tudo (veículos, trajetos, etc.).",
  },
  {
    id: "instalar",
    title: "Instalar o app no celular",
    keywords: ["instalar", "tela de inicio", "tela inicial", "icone na tela", "app", "baixar", "pwa", "atalho"],
    answer:
      "Para ter o GO como app no celular:\n• **iPhone (Safari):** toque em Compartilhar (⬆️) → **Adicionar à Tela de Início**.\n• **Android (Chrome):** menu ⋮ → **Instalar app / Adicionar à tela inicial**.\n\nAssim ele abre em tela cheia e libera as notificações. 📲",
  },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ");

export const SUGGESTED_QUESTIONS = [
  "Como rastrear meu equipamento?",
  "Como ativar as notificações?",
  "Como criar uma cerca eletrônica?",
  "Como bloquear o veículo?",
  "Como funciona o SOS?",
  "Como mudar o ícone (pet, moto...)?",
];

/** Returns the best-matching help entry, or null when nothing matches well. */
export function matchHelp(query: string): HelpEntry | null {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return null;

  let best: { entry: HelpEntry; score: number } | null = null;
  for (const entry of HELP_ENTRIES) {
    let score = 0;
    for (const kw of entry.keywords) {
      const nkw = norm(kw);
      if (words.includes(nkw)) score += 2;
      else if (words.some((w) => w.includes(nkw) || nkw.includes(w))) score += 1;
    }
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 2 ? best.entry : null;
}
