import { useEffect, useState } from "react";
import { Search, Loader2, X, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Suggestion = { label: string; lat: string; lng: string };

/**
 * Reusable address / CEP search with autocomplete. As the user types, shows
 * clickable suggestions (ViaCEP for CEPs + Nominatim for addresses) and calls
 * `onSelect` with the chosen coordinates + label.
 */
export function AddressSearch({
  onSelect,
  placeholder = "Buscar CEP ou endereço...",
  className,
  autoFocus,
}: {
  onSelect: (lat: number, lng: number, label: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      utils.geo.search
        .fetch({ query: q })
        .then((res) => setSuggestions(res))
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query, utils]);

  const clear = () => { setQuery(""); setSuggestions([]); };

  return (
    <div className={cn("relative", className)}>
      <div className="bg-white rounded-xl shadow-md flex items-center px-3 h-12 border border-gray-100">
        <Search className="w-4 h-4 text-gray-500 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          inputMode="search"
          autoFocus={autoFocus}
          className="flex-1 px-2 text-sm outline-none bg-transparent"
        />
        {searching ? (
          <Loader2 className="w-4 h-4 text-gray-500 animate-spin shrink-0" />
        ) : query ? (
          <button onClick={clear} className="go-btn-active shrink-0" aria-label="Limpar">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        ) : null}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-[1000] max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { onSelect(parseFloat(s.lat), parseFloat(s.lng), s.label); clear(); }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-start gap-2 border-b border-gray-50 last:border-0 go-btn-active"
            >
              <MapPin className="w-4 h-4 text-[#243FF7] mt-0.5 shrink-0" />
              <span className="text-[13px] text-gray-700 leading-snug">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
