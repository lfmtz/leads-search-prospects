
import React, { useState } from 'react';
import { SearchForm } from './components/SearchForm';
import { ResultsTable } from './components/ResultsTable';
import { Map } from './components/Map';
import { Analytics } from './components/Analytics';
import { fetchLeads, fetchMarketIntelligence } from './services/geminiService';
import { Lead, SearchParams } from './types';

export type LogEntry = {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'success';
};

const App: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [marketIntel, setMarketIntel] = useState<{ total: number, categories: {name: string, count: number}[] } | null>(null);
  const [hasStartedExtraction, setHasStartedExtraction] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMassExtracting, setIsMassExtracting] = useState(false);
  const [massExtractProgress, setMassExtractProgress] = useState(0);
  const [currentParams, setCurrentParams] = useState<SearchParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const logsEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), timestamp: new Date(), message, type }]);
  };

  const handleClearCache = () => {
    setLeads([]);
    setCategoryFilter(null);
    setCurrentParams(null);
    setMarketIntel(null);
    setHasStartedExtraction(false);
    setError(null);
    setMassExtractProgress(0);
    setLogs([{ id: Math.random().toString(), timestamp: new Date(), message: 'Caché y logs limpiados (Sesión reseteada).', type: 'success' }]);
  };

  const handleSearch = async (params: SearchParams) => {
    setIsLoading(true);
    setError(null);
    setCategoryFilter(null);
    setCurrentParams(params);
    setLeads([]);
    setMarketIntel(null);
    setHasStartedExtraction(false);
    setMassExtractProgress(0);
    
    addLog(`Consultando inteligencia de mercado en ${params.municipality}, ${params.state}...`, 'info');
    
    try {
      const intel = await fetchMarketIntelligence(params.state, params.municipality);
      setMarketIntel(intel);
      addLog(`Se encontraron ~${intel.total} negocios registrados en la zona.`, 'success');
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`🚨 Error detectado al consultar inteligencia: ${errorMessage}`, 'error');
      setError("Error al consultar el inventario de la zona.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExtraction = async () => {
    if (!currentParams) return;
    setHasStartedExtraction(true);
    setIsMassExtracting(true);
    setError(null);
    
    addLog(`Iniciando extracción profunda (100 leads) en ${currentParams.municipality}...`, 'info');
    
    await executeExtractionBatch(0, []);
  };

  const executeExtractionBatch = async (startCount: number, currentLeads: Lead[]) => {
    if (!currentParams) return;
    
    let currentLeadsCount = startCount;
    let accumulatedLeads: Lead[] = [...currentLeads];
    let consecutiveEmptyResponses = 0;
    const TARGET_LEADS = currentLeadsCount + 100;

    try {
      addLog(`Intentando recuperar lote de registros hasta el ${TARGET_LEADS}...`, 'info');
      while (currentLeadsCount < TARGET_LEADS && consecutiveEmptyResponses < 3) {
        let fetchTarget = Math.min(50, TARGET_LEADS - currentLeadsCount);
        addLog(`Iniciando scroll e invocando scraper para recuperar ${fetchTarget} registros (offset ${currentLeadsCount})...`, 'info');
        setMassExtractProgress(currentLeadsCount);
        
        const data = await fetchLeads(currentParams, currentLeadsCount);
        
        if (data.length === 0) {
          consecutiveEmptyResponses++;
          addLog(`Respuesta vacía del scraper. Reintentando (${consecutiveEmptyResponses}/3)...`, 'error');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        consecutiveEmptyResponses = 0;
        
        const existingKeys = new Set(accumulatedLeads.map(l => `${l.name}-${l.street}`.toLowerCase()));
        const newLeads = data.filter(l => !existingKeys.has(`${l.name}-${l.street}`.toLowerCase()));
        
        if (newLeads.length === 0) {
          consecutiveEmptyResponses++;
          addLog(`Se obtuvieron leads duplicados, reintentando scroll...`, 'info');
          continue;
        }

        accumulatedLeads = [...accumulatedLeads, ...newLeads];
        currentLeadsCount = accumulatedLeads.length;
        
        addLog(`Bloque parcial de ${newLeads.length} leads descargado en buffer local. Progreso: ${currentLeadsCount}/${TARGET_LEADS}`, 'success');
        
        // Progress shown in UI but DO NOT render Map/Table yet to save Memory!
        setMassExtractProgress(currentLeadsCount);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (accumulatedLeads.length === startCount) {
        addLog("No se encontraron más resultados adicionales en esta zona.", 'error');
        setError("No se encontraron más resultados adicionales en esta zona.");
      } else {
        addLog(`Lote de 100 completado exitosamente. Total acumulado: ${accumulatedLeads.length}`, 'success');
        setLeads(accumulatedLeads);
      }
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      
      if (errorMessage.includes("fetch")) errorMessage = "Connection Refused / Timeout de Red";
      if (errorMessage.includes("429")) errorMessage = "Memory Limit / Rate Limit Superado";
      if (errorMessage.includes("JSON")) errorMessage = "Error en JSON Parse / Respuesta sucia";
      
      addLog(`🚨 Error detectado: ${errorMessage}.${stack ? ` | Stack: ${stack.split('\n')[1] || ''}` : ''} El proceso se detuvo en el registro ${currentLeadsCount}.`, 'error');
      setError("Ocurrió un error en la extracción. Revisa la consola de diagnóstico.");
      console.error(err);
    } finally {
      setIsMassExtracting(false);
      setIsLoading(false);
      setMassExtractProgress(accumulatedLeads.length);
    }
  };

  const handleLoadMore = async () => {
    setIsLoading(true);
    setIsMassExtracting(true);
    await executeExtractionBatch(leads.length, leads);
  };

  const handleCategoryClick = (category: string) => {
    setCategoryFilter(prev => prev === category ? null : category);
  };

  const downloadCSV = (dataToDownload: Lead[], suffix: string) => {
    if (dataToDownload.length === 0) return;
    
    const headers = ["Nombre", "Teléfono", "Giro", "Calle", "Colonia", "CP", "Sitio Web", "Redes Sociales", "Municipio", "Calificación", "Horarios", "Latitud", "Longitud", "Maps URL"];
    const rows = dataToDownload.map(l => [
      `"${l.name}"`,
      `"${l.phone}"`,
      `"${l.category}"`,
      `"${l.street}"`,
      `"${l.neighborhood}"`,
      `"${l.zipCode}"`,
      `"${l.website}"`,
      `"${l.socialMedia || 'N/A'}"`,
      `"${l.municipality}"`,
      `"${l.rating}"`,
      `"${l.schedule}"`,
      l.lat,
      l.lng,
      `"${l.mapsUrl || ''}"`
    ]);
    
    // Add BOM (\uFEFF) for utf-8-sig so Excel reads accents correctly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_${currentParams?.municipality}_${suffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const availableNiches = React.useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      const cat = l.category && l.category !== 'N/A' ? l.category : 'Otros';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a,b) => b.count - a.count);
  }, [leads]);

  const filterOptions = hasStartedExtraction ? availableNiches : (marketIntel?.categories || []);

  const displayedLeads = React.useMemo(() => {
    if (!categoryFilter) return []; // Empty map and table until niche selected
    return leads.filter(l => {
      const cat = l.category && l.category !== 'N/A' ? l.category : 'Otros';
      return cat === categoryFilter;
    });
  }, [leads, categoryFilter]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Header */}
      <header className="bg-[#6A0DAD] text-white py-8 px-4 shadow-xl mb-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-radar"><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/></svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">LeadScrapper MX</h1>
              <p className="text-purple-200 text-sm font-medium">Dashboard de Inteligencia Comercial</p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 text-right hidden md:block">
            <p className="text-sm text-purple-200">Prospección Comercial de Alta Precisión</p>
            <p className="text-xs text-purple-300">Nissan / Seguros</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4">
        {/* Error Notification */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Filters */}
          <div className="lg:col-span-3">
            <SearchForm 
              onSearch={handleSearch} 
              isLoading={isLoading} 
              onNicheSelect={setCategoryFilter}
              selectedNiche={categoryFilter}
              availableNiches={filterOptions}
            />
            
            {/* Progress Indicator */}
            {isMassExtracting && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#6A0DAD]">Buscando 100 leads... por favor espera</span>
                  <span className="text-sm font-bold text-purple-800">{massExtractProgress} leads en memoria</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-[#6A0DAD] h-2.5 rounded-full w-full animate-pulse"></div>
                </div>
                <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </p>
              </div>
            )}
          </div>

          {/* Right Area: Minimalist or Detailed View */}
          <div className="lg:col-span-9 flex flex-col gap-6">
            {!hasStartedExtraction && marketIntel ? (
              <div className="bg-white p-8 rounded-xl shadow-lg border border-purple-100 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                <div className="bg-gradient-to-br from-[#6A0DAD] to-purple-800 rounded-2xl p-8 text-white shadow-xl flex flex-col items-center gap-4 w-full max-w-2xl">
                  <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-extrabold mb-1">
                      Total de Negocios Detectados en la Zona:
                    </h2>
                    <p className="text-purple-200 text-6xl font-black tracking-wider mt-2">{marketIntel.total}</p>
                  </div>
                  
                  <div className="w-full mt-6 bg-white/10 rounded-xl p-4 text-left">
                    <p className="text-purple-100 text-sm font-semibold mb-3 border-b border-purple-400/30 pb-2">Distribución de Giros Estimada:</p>
                    <div className="flex flex-wrap gap-2">
                       {marketIntel.categories.map(c => (
                         <span key={c.name} className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium border border-white/20">
                            {c.name}: {c.count}
                         </span>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  <button
                    onClick={handleStartExtraction}
                    disabled={isMassExtracting}
                    className="flex items-center justify-center gap-2 bg-[#6A0DAD] hover:bg-purple-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMassExtracting ? (
                      <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    )}
                    Extraer lote de 100 leads
                  </button>
                  <p className="text-gray-400 text-sm mt-4">Una vez extraída la información, podrás exportar un CSV de toda la base o por categoría.</p>
                </div>
              </div>
            ) : hasStartedExtraction ? (
              <div className="grid grid-cols-1 lg:grid-cols-9 gap-6">
                {/* Central Column: Map */}
                <div className="lg:col-span-6">
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 h-full flex flex-col">
                    <h3 className="text-xl font-bold text-[#6A0DAD] mb-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
                      Visualización Geoespacial
                    </h3>
                    <div className="h-[650px] w-full relative flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                      {currentParams ? (
                        <Map leads={displayedLeads} searchParams={currentParams} />
                      ) : (
                        <div className="text-center p-6">
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin text-gray-300 mx-auto mb-4"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                          <h3 className="text-lg font-semibold text-gray-500 mb-2">Esperando búsqueda de zona...</h3>
                          <p className="text-sm text-gray-400">Selecciona un estado y municipio para visualizar la zona geográfica.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Analytics */}
                <div className="lg:col-span-3">
                  {leads.length > 0 ? (
                    <Analytics 
                      leads={leads} 
                      onCategoryClick={handleCategoryClick} 
                      activeCategory={categoryFilter} 
                    />
                  ) : (
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-full flex flex-col items-center justify-center text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bar-chart-3 text-gray-300 mb-4"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                      <h3 className="text-lg font-semibold text-gray-500 mb-2">Dashboard de Analítica</h3>
                      <p className="text-sm text-gray-400">Realiza una búsqueda para visualizar la densidad de negocios.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom Section: Results Table */}
        {leads.length > 0 && (
          <div className="mt-8 space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Total Leads Card */}
              <div className="bg-gradient-to-br from-[#6A0DAD] to-purple-800 rounded-xl p-6 text-white shadow-lg flex items-center gap-5">
                <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
                </div>
                <div>
                  <p className="text-purple-200 text-sm font-medium mb-1 uppercase tracking-wider">Total de Negocios Encontrados en {currentParams?.municipality}</p>
                  <h4 className="text-4xl font-extrabold">{leads.length}</h4>
                </div>
              </div>

              {/* Filtered Leads Card */}
              <div className="bg-white border-2 border-[#6A0DAD] rounded-xl p-6 text-[#6A0DAD] shadow-lg flex items-center gap-5">
                <div className="p-4 bg-purple-100 rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-medium mb-1 uppercase tracking-wider">Negocios tras el filtro</p>
                  <h4 className="text-4xl font-extrabold">{displayedLeads.length}</h4>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-[#6A0DAD] flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-table-properties"><path d="M15 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M21 9H3"/><path d="M21 15H3"/></svg>
                  Resultados Obtenidos ({displayedLeads.length})
                </h2>
                {categoryFilter && (
                  <button 
                    onClick={() => setCategoryFilter(null)}
                    className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 bg-purple-100 px-3 py-1 rounded-full"
                  >
                    Filtro: {categoryFilter}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 bg-purple-100 hover:bg-purple-200 text-[#6A0DAD] px-5 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                  )}
                  Extraer lote de 100 leads
                </button>
                
                {categoryFilter ? (
                  <button
                    onClick={() => downloadCSV(displayedLeads, `nicho-${categoryFilter.replace(/\s+/g, '-').toLowerCase()}`)}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold shadow-md transition-all active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Descargar CSV Nicho ({displayedLeads.length})
                  </button>
                ) : (
                  <button
                    onClick={() => downloadCSV(leads, 'completos')}
                    className="flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-5 py-2 rounded-lg font-semibold shadow-md transition-all active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Descargar Toda la Base ({leads.length})
                  </button>
                )}
              </div>
            </div>
            
            {displayedLeads.length > 0 ? (
              <ResultsTable leads={displayedLeads} />
            ) : (
              <div className="bg-white p-12 rounded-xl border-2 border-dashed border-purple-200 text-center flex flex-col items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mouse-pointer-click text-purple-300 mb-4"><path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/></svg>
                {categoryFilter ? (
                  <>
                    <h3 className="text-xl font-bold text-amber-600 mb-2">No hay negocios de este tipo en la zona seleccionada</h3>
                    <p className="text-gray-500 max-w-md">El filtro '{categoryFilter}' no encontró resultados en los {leads.length} leads descargados actualmente.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-[#6A0DAD] mb-2">Selecciona un Nicho de Mercado</h3>
                    <p className="text-gray-500 max-w-md">Para activar la tabla de resultados y mostrar los pines en el mapa, selecciona uno de los giros encontrados en la gráfica de Inteligencia de Mercado o desde el menú Selector de Nicho Dinámico.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && leads.length === 0 && !error && !marketIntel && (
          <div className="mt-8 text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-[#6A0DAD] mb-4 opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">¡Bienvenido al equipo de ventas corporativas Nissan y Seguros!</h3>
            <p className="text-gray-500 max-w-md mx-auto">Selecciona un Estado, Municipio y descubre los giros comerciales con mayor potencial en la zona para comenzar tu prospección estratégica.</p>
          </div>
        )}

        {/* Diagnostic Console */}
        <div className="mt-12 bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
          <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
             <h3 className="text-white font-mono text-sm font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg> 
                Consola de Diagnóstico (Logs)
             </h3>
             <button 
               onClick={handleClearCache} 
               className="text-xs bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 px-3 py-1 rounded shadow transition-colors flex items-center gap-1"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               Limpiar Caché y Logs
             </button>
          </div>
          <div className="h-48 overflow-y-auto p-4 font-mono text-xs flex flex-col gap-1.5 custom-scrollbar">
             {logs.length === 0 && (
               <span className="text-gray-500 italic">Sistema listo. Esperando comandos...</span>
             )}
             {logs.map(log => (
               <div key={log.id} className={`${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-gray-300'}`}>
                 <span className="text-gray-500">[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
               </div>
             ))}
             <div ref={logsEndRef} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-200 pt-8 pb-4 text-center">
        <p className="text-gray-500 text-sm font-medium">
          &copy; {new Date().getFullYear()} LeadScrapper MX - Senior Fullstack Engineering Demo
        </p>
      </footer>
    </div>
  );
};

export default App;
