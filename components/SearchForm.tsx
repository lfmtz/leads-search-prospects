
import React, { useState, useEffect } from 'react';
import { SearchParams } from '../types';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
  onNicheSelect?: (niche: string | null) => void;
  selectedNiche?: string | null;
  availableNiches?: { name: string, count: number }[];
}

const SEPOMEX_DATA: Record<string, string[]> = {
  "Ciudad de México": ["Álvaro Obregón", "Azcapotzalco", "Benito Juárez", "Coyoacán", "Cuajimalpa de Morelos", "Cuauhtémoc", "Gustavo A. Madero", "Iztacalco", "Iztapalapa", "Magdalena Contreras", "Miguel Hidalgo", "Milpa Alta", "Tláhuac", "Tlalpan", "Venustiano Carranza", "Xochimilco"],
  "Estado de México": ["Toluca", "Ecatepec", "Nezahualcóyotl", "Naucalpan", "Tlalnepantla", "Chimalhuacán", "Cuautitlán Izcalli", "Atizapán de Zaragoza", "Tultitlán", "Ixtapaluca", "Tecámac", "Valle de Chalco Solidaridad", "Chalco", "Coacalco", "La Paz", "Huixquilucan", "Texcoco", "Metepec", "Zumpango", "Chicoloapan"],
  "Jalisco": ["Guadalajara", "Zapopan", "Tlaquepaque", "Tonalá", "Tlajomulco de Zúñiga", "Puerto Vallarta"],
  "Nuevo León": ["Monterrey", "Guadalupe", "Apodaca", "San Nicolás de los Garza", "General Escobedo", "Santa Catarina", "San Pedro Garza García"],
  "Puebla": ["Puebla", "Tehuacán", "San Martín Texmelucan", "Atlixco", "Cholula"],
  "Querétaro": ["Querétaro", "San Juan del Río", "Corregidora", "El Marqués"]
};

export const SearchForm: React.FC<SearchFormProps> = ({ 
  onSearch, 
  isLoading, 
  onNicheSelect, 
  selectedNiche,
  availableNiches = []
}) => {
  const [params, setParams] = useState<SearchParams>({
    state: '',
    municipality: '',
    business_type: 'Todos los negocios',
  });

  const [municipalities, setMunicipalities] = useState<string[]>([]);

  useEffect(() => {
    if (params.state && SEPOMEX_DATA[params.state]) {
      setMunicipalities(SEPOMEX_DATA[params.state]);
      setParams(prev => ({ ...prev, municipality: '' }));
    } else {
      setMunicipalities([]);
    }
  }, [params.state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.state || !params.municipality) return;
    onSearch({ ...params, business_type: 'Todos los negocios' });
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 flex flex-col h-full"
    >
      <h3 className="text-xl font-bold text-[#6A0DAD] mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-filter"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtros SEPOMEX
      </h3>
      
      <div className="space-y-5 flex-grow">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Estado
          </label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#6A0DAD] focus:border-transparent outline-none transition-all bg-white"
            value={params.state}
            onChange={(e) => setParams({ ...params, state: e.target.value })}
            required
          >
            <option value="" disabled>Selecciona un Estado</option>
            {Object.keys(SEPOMEX_DATA).map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Municipio / Alcaldía
          </label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#6A0DAD] focus:border-transparent outline-none transition-all bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={params.municipality}
            onChange={(e) => {
              const selectedMunicipality = e.target.value;
              const newParams = { ...params, municipality: selectedMunicipality, business_type: 'Todos los negocios' };
              
              setParams(newParams);
              
              if (onNicheSelect) onNicheSelect(null);
              
              if (newParams.state && selectedMunicipality) {
                // Auto-trigger main search for map, table and chart
                onSearch(newParams);
              }
            }}
            required
            disabled={!params.state}
          >
            <option value="" disabled>Selecciona un Municipio</option>
            {municipalities.map(mun => (
              <option key={mun} value={mun}>{mun}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Selector de Nicho Dinámico
          </label>
          <div className="flex flex-col gap-2">
            <select
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#6A0DAD] focus:border-transparent outline-none transition-all bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={selectedNiche || ""}
              onChange={(e) => {
                if (onNicheSelect) onNicheSelect(e.target.value || null);
              }}
              disabled={availableNiches.length === 0}
            >
              <option value="" disabled>
                {availableNiches.length === 0 ? "Esperando barrido..." : "Selecciona un giro (Activa Pines)"}
              </option>
              {availableNiches.map(niche => (
                <option key={niche.name} value={niche.name}>
                  {niche.name} ({niche.count})
                </option>
              ))}
            </select>
            {availableNiches.length > 0 && !selectedNiche && (
              <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                Selecciona un giro para poblar el mapa y la tabla
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`mt-4 w-full py-3 px-6 rounded-lg text-white font-bold text-lg transition-all ${
          isLoading 
          ? 'bg-purple-400 cursor-not-allowed' 
          : 'bg-[#6A0DAD] hover:bg-purple-800 active:scale-[0.98] shadow-md'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analizando Zona...
          </span>
        ) : 'Buscar'}
      </button>
    </form>
  );
};
