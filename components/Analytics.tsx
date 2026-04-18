import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Lead } from '../types';

interface AnalyticsProps {
  leads: Lead[];
  onCategoryClick?: (category: string) => void;
  activeCategory?: string | null;
}

export const Analytics: React.FC<AnalyticsProps> = ({ leads, onCategoryClick, activeCategory }) => {
  const data = useMemo(() => {
    if (!leads || leads.length === 0) return [];
    
    const categoryCounts: Record<string, number> = {};
    leads.forEach(lead => {
      const cat = lead.category && lead.category !== "N/A" ? lead.category : "Otros";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    return Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8
  }, [leads]);

  if (leads.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-full">
      <h3 className="text-xl font-bold text-[#6A0DAD] mb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bar-chart-3"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        Densidad por Categoría
      </h3>
      <p className="text-xs text-gray-500 mb-4">Haz clic en una barra para filtrar la tabla.</p>
      <div className="w-full overflow-x-auto" style={{ minHeight: '450px', minWidth: '100%' }}>
        <div style={{ width: '800px', height: '450px' }}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            layout="vertical"
            width={800}
            height={450}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#4b5563', fontSize: 12 }}
              width={100}
            />
            <Tooltip 
              cursor={{ fill: '#f3f4f6' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            />
            <Bar 
              dataKey="count" 
              radius={[0, 4, 4, 0]} 
              barSize={24}
              onClick={(data) => onCategoryClick && onCategoryClick(data.name)}
              className="cursor-pointer transition-opacity hover:opacity-80"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={activeCategory === entry.name ? "#4C0080" : "#6A0DAD"} 
                  fillOpacity={activeCategory && activeCategory !== entry.name ? 0.3 : 0.8 + (index * 0.02)} 
                />
              ))}
            </Bar>
          </BarChart>
        </div>
      </div>
    </div>
  );
};
