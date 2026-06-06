/**
 * Navegação "voltar" consistente: retorna para a página de onde o usuário veio
 * (não um destino fixo). Ex.: Equipamentos aberto pelo Perfil volta ao Perfil;
 * aberto pela Home volta à Home. Se não houver histórico (deep link), usa o
 * fallback.
 */
export function goBack(setLocation: (to: string) => void, fallback = "/") {
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
  } else {
    setLocation(fallback);
  }
}
