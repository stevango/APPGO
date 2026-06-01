import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Language = "pt" | "en" | "es";

type Translations = Record<string, Record<Language, string>>;

// Traduções centralizadas do app
const translations: Translations = {
  // Header / Saudação
  "hello": { pt: "Olá,", en: "Hello,", es: "Hola," },
  
  // Quick Actions
  "locate": { pt: "Localizar", en: "Locate", es: "Localizar" },
  "block": { pt: "Bloquear", en: "Block", es: "Bloquear" },
  "fence": { pt: "Cerca", en: "Geofence", es: "Cerca" },
  "theft": { pt: "Furto/Roubo", en: "Theft", es: "Robo" },
  "assistance": { pt: "Assistência", en: "Assistance", es: "Asistencia" },
  "history": { pt: "Histórico", en: "History", es: "Historial" },
  "share": { pt: "Compartilhar", en: "Share", es: "Compartir" },
  "quick_actions": { pt: "Ações rápidas", en: "Quick actions", es: "Acciones rápidas" },

  // Vehicle Status
  "vehicle_status": { pt: "Status do veículo", en: "Vehicle status", es: "Estado del vehículo" },
  "connection": { pt: "Conexão", en: "Connection", es: "Conexión" },
  "online": { pt: "Online", en: "Online", es: "En línea" },
  "offline": { pt: "Offline", en: "Offline", es: "Sin conexión" },
  "main_battery": { pt: "Bateria Principal", en: "Main Battery", es: "Batería Principal" },
  "backup_battery": { pt: "Bateria Backup", en: "Backup Battery", es: "Batería Respaldo" },
  "ignition": { pt: "Ignição", en: "Ignition", es: "Ignición" },
  "on": { pt: "Ligada", en: "On", es: "Encendida" },
  "off": { pt: "Desligada", en: "Off", es: "Apagada" },
  "block_status": { pt: "Bloqueio", en: "Block", es: "Bloqueo" },
  "blocked": { pt: "Bloqueado", en: "Blocked", es: "Bloqueado" },
  "unblocked": { pt: "Desbloqueado", en: "Unblocked", es: "Desbloqueado" },
  "last_signal": { pt: "Último sinal", en: "Last signal", es: "Última señal" },
  "location_unavailable": { pt: "Localização não disponível", en: "Location unavailable", es: "Ubicación no disponible" },
  "no_vehicle": { pt: "Nenhum veículo", en: "No vehicle", es: "Sin vehículo" },
  "no_vehicle_desc": { pt: "Seu veículo aparecerá aqui após a ativação do rastreador.", en: "Your vehicle will appear here after tracker activation.", es: "Su vehículo aparecerá aquí después de activar el rastreador." },

  // Battery Alerts
  "critical_battery": { pt: "Bateria Crítica!", en: "Critical Battery!", es: "¡Batería Crítica!" },
  "low_battery": { pt: "Bateria Baixa", en: "Low Battery", es: "Batería Baja" },
  "check_immediately": { pt: "Verifique o veículo imediatamente. Risco de perda de rastreamento.", en: "Check the vehicle immediately. Risk of tracking loss.", es: "Verifique el vehículo inmediatamente. Riesgo de pérdida de rastreo." },
  "check_soon": { pt: "Recomendamos verificar a bateria em breve.", en: "We recommend checking the battery soon.", es: "Recomendamos verificar la batería pronto." },

  // Speed Alert
  "excessive_speed": { pt: "Velocidade Excessiva!", en: "Excessive Speed!", es: "¡Velocidad Excesiva!" },
  "limit": { pt: "Limite", en: "Limit", es: "Límite" },

  // Tracking
  "tracking": { pt: "Rastreamento", en: "Tracking", es: "Rastreo" },
  "real_time": { pt: "Tempo real", en: "Real time", es: "Tiempo real" },
  "speed": { pt: "Velocidade", en: "Speed", es: "Velocidad" },
  "address": { pt: "Endereço", en: "Address", es: "Dirección" },

  // Profile
  "profile": { pt: "Perfil", en: "Profile", es: "Perfil" },
  "language": { pt: "Idioma", en: "Language", es: "Idioma" },
  "logout": { pt: "Sair", en: "Logout", es: "Cerrar sesión" },
  "settings": { pt: "Configurações", en: "Settings", es: "Configuraciones" },
  "notifications": { pt: "Notificações", en: "Notifications", es: "Notificaciones" },
  "my_vehicles": { pt: "Meus Veículos", en: "My Vehicles", es: "Mis Vehículos" },

  // Geofences
  "geofences": { pt: "Cercas Virtuais", en: "Geofences", es: "Geocercas" },
  "create_geofence": { pt: "Criar cerca", en: "Create geofence", es: "Crear geocerca" },
  "active": { pt: "Ativa", en: "Active", es: "Activa" },
  "inactive": { pt: "Inativa", en: "Inactive", es: "Inactiva" },

  // Share Location
  "share_location": { pt: "Compartilhar Localização", en: "Share Location", es: "Compartir Ubicación" },
  "manage_links": { pt: "Gerencie links de compartilhamento", en: "Manage sharing links", es: "Gestionar enlaces de compartir" },
  "create_new_link": { pt: "Criar novo link", en: "Create new link", es: "Crear nuevo enlace" },
  "generate_temp_link": { pt: "Gere um link temporário para compartilhar", en: "Generate a temporary sharing link", es: "Genere un enlace temporal para compartir" },
  "limit_reached": { pt: "Limite atingido", en: "Limit reached", es: "Límite alcanzado" },
  "revoke_to_create": { pt: "Revogue um link ativo para criar um novo (máx. 5)", en: "Revoke an active link to create a new one (max. 5)", es: "Revoque un enlace activo para crear uno nuevo (máx. 5)" },
  "active_links": { pt: "Links ativos", en: "Active links", es: "Enlaces activos" },
  "link_duration": { pt: "Duração do link", en: "Link duration", es: "Duración del enlace" },
  "contact_name": { pt: "Nome do contato (opcional)", en: "Contact name (optional)", es: "Nombre del contacto (opcional)" },
  "cancel": { pt: "Cancelar", en: "Cancel", es: "Cancelar" },
  "create": { pt: "Criar", en: "Create", es: "Crear" },
  "revoke": { pt: "Revogar", en: "Revoke", es: "Revocar" },
  "confirm_revoke": { pt: "Confirmar revogação", en: "Confirm revocation", es: "Confirmar revocación" },
  "revoke_desc": { pt: "O link será desativado imediatamente e não poderá mais ser acessado.", en: "The link will be deactivated immediately and can no longer be accessed.", es: "El enlace será desactivado inmediatamente y ya no podrá ser accedido." },

  // SOS
  "sos_title": { pt: "Assistência 24h", en: "24h Assistance", es: "Asistencia 24h" },
  "call_now": { pt: "Ligar agora", en: "Call now", es: "Llamar ahora" },

  // Report Theft
  "report_theft": { pt: "Reportar Furto/Roubo", en: "Report Theft", es: "Reportar Robo" },

  // Trip History
  "trip_history": { pt: "Histórico de Viagens", en: "Trip History", es: "Historial de Viajes" },

  // Block Vehicle
  "block_vehicle": { pt: "Bloquear Veículo", en: "Block Vehicle", es: "Bloquear Vehículo" },
  "unblock_vehicle": { pt: "Desbloquear Veículo", en: "Unblock Vehicle", es: "Desbloquear Vehículo" },

  // Vehicles
  "vehicles": { pt: "Veículos", en: "Vehicles", es: "Vehículos" },
  "edit": { pt: "Editar", en: "Edit", es: "Editar" },
  "add_vehicle": { pt: "Adicionar veículo", en: "Add vehicle", es: "Agregar vehículo" },
  "selected": { pt: "Selecionado", en: "Selected", es: "Seleccionado" },

  // Promo Banners
  "assistance_24h": { pt: "Assistência 24h", en: "24h Assistance", es: "Asistencia 24h" },
  "first_month_off": { pt: "80% OFF no 1º mês", en: "80% OFF first month", es: "80% OFF primer mes" },
  "get_discount": { pt: "Aproveitar desconto", en: "Get discount", es: "Aprovechar descuento" },
  "vehicle_insurance": { pt: "Seguro Veicular", en: "Vehicle Insurance", es: "Seguro Vehicular" },
  "full_protection": { pt: "Proteção completa", en: "Full protection", es: "Protección completa" },
  "get_quote": { pt: "Fazer cotação", en: "Get a quote", es: "Hacer cotización" },
  "refer_earn": { pt: "Indique e Ganhe", en: "Refer & Earn", es: "Recomienda y Gana" },
  "per_referral": { pt: "R$50 por indicação", en: "$10 per referral", es: "$10 por referencia" },
  "refer_now": { pt: "Indicar agora", en: "Refer now", es: "Recomendar ahora" },

  // General
  "loading": { pt: "Carregando...", en: "Loading...", es: "Cargando..." },
  "error": { pt: "Erro", en: "Error", es: "Error" },
  "success": { pt: "Sucesso", en: "Success", es: "Éxito" },
  "confirm": { pt: "Confirmar", en: "Confirm", es: "Confirmar" },
  "back": { pt: "Voltar", en: "Back", es: "Volver" },
  "save": { pt: "Salvar", en: "Save", es: "Guardar" },
  "delete": { pt: "Excluir", en: "Delete", es: "Eliminar" },
  "close": { pt: "Fechar", en: "Close", es: "Cerrar" },

  // Navigation
  "home": { pt: "Início", en: "Home", es: "Inicio" },
  "map": { pt: "Mapa", en: "Map", es: "Mapa" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_LABELS: Record<Language, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("go-app-language");
    if (saved && (saved === "pt" || saved === "en" || saved === "es")) {
      return saved as Language;
    }
    // Detectar idioma do navegador
    const browserLang = navigator.language.slice(0, 2);
    if (browserLang === "es") return "es";
    if (browserLang === "en") return "en";
    return "pt";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("go-app-language", lang);
  }, []);

  const t = useCallback((key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry["pt"] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export { LANGUAGE_LABELS };
