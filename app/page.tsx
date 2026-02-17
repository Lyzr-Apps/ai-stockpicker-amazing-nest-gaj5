'use client'

import { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { getSchedule, pauseSchedule, resumeSchedule, cronToHuman, getScheduleLogs, triggerScheduleNow } from '@/lib/scheduler'
import type { Schedule, ExecutionLog } from '@/lib/scheduler'
import parseLLMJson from '@/lib/jsonParser'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

import {
  Search, TrendingUp, BarChart3, Shield, Zap, RefreshCw, Settings, Home, Clock, Star,
  ChevronDown, ChevronUp, ChevronRight, Filter, AlertCircle, Check, Loader2,
  ArrowUp, ArrowDown, Eye, Send, Play, Pause, Calendar, ExternalLink, Hash,
  Globe, Target, Activity, Menu, X
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COORDINATOR_AGENT_ID = '699316c03f10687c1b73366e'
const TEAMS_AGENT_ID = '699316dacb2b470c78df003c'
const SCHEDULE_ID = '699316e1399dfadeac3775a8'

const SECTORS = [
  'IT Services', 'Pharma', 'BFSI', 'Auto', 'FMCG',
  'Metals', 'Infrastructure', 'Chemicals', 'Textiles', 'Defence'
]

const MARKET_CAP_LABELS: Record<number, string> = {
  0: 'Micro (below 500 Cr)',
  1: 'Small (500-5,000 Cr)',
  2: 'Mid (5,000-20,000 Cr)',
  3: 'Large (20,000 Cr+)',
}

const RISK_LEVELS = ['Conservative', 'Moderate', 'Aggressive'] as const

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Recommendation {
  rank: number
  ticker: string
  company_name: string
  sector: string
  current_price: string
  target_price: string
  upside_percentage: string
  composite_score: number
  fundamental_score: number
  technical_score: number
  sentiment_score: number
  risk_level: string
  market_cap: string
  pe_ratio: string
  revenue_growth: string
  buy_rationale: string
  key_risks: string
  entry_point: string
  stop_loss: string
  insider_activity: string
  catalyst: string
}

interface AnalysisResult {
  recommendations: Recommendation[]
  analysis_summary: string
  market_outlook: string
  total_candidates_screened: number
  analysis_date: string
}

interface TeamsAlertResult {
  delivery_status: string
  channel_name: string
  message_preview: string
  stocks_included: number
  alert_type: string
  timestamp: string
}

interface HistoryEntry {
  id: string
  timestamp: string
  total_candidates_screened: number
  recommendations_count: number
  market_outlook: string
  analysis_summary: string
}

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_RECOMMENDATIONS: Recommendation[] = [
  {
    rank: 1,
    ticker: 'TATAELXSI',
    company_name: 'Tata Elxsi Limited',
    sector: 'IT Services',
    current_price: 'Rs. 7,450',
    target_price: 'Rs. 10,500',
    upside_percentage: '40.9%',
    composite_score: 9.1,
    fundamental_score: 8.9,
    technical_score: 9.2,
    sentiment_score: 9.2,
    risk_level: 'Medium',
    market_cap: 'Rs. 46,400 Cr',
    pe_ratio: '62.5',
    revenue_growth: '28%',
    buy_rationale: 'Leading embedded product design company benefiting from EV, autonomous driving, and media & entertainment digitization. Strong order book with marquee global OEM clients. High promoter holding at 43.9% with zero promoter pledge.',
    key_risks: 'Rich valuation multiples, client concentration risk, global auto slowdown impacting ER&D spends, INR appreciation impacting margins.',
    entry_point: 'Rs. 7,200-7,500',
    stop_loss: 'Rs. 6,500',
    insider_activity: 'No significant insider selling; promoter holding stable',
    catalyst: 'EV design wins, new OEM partnerships, margin expansion from AI/ML services'
  },
  {
    rank: 2,
    ticker: 'DIXON',
    company_name: 'Dixon Technologies',
    sector: 'Infrastructure',
    current_price: 'Rs. 12,800',
    target_price: 'Rs. 18,000',
    upside_percentage: '40.6%',
    composite_score: 8.8,
    fundamental_score: 8.6,
    technical_score: 8.4,
    sentiment_score: 9.4,
    risk_level: 'Medium',
    market_cap: 'Rs. 76,500 Cr',
    pe_ratio: '115',
    revenue_growth: '68%',
    buy_rationale: 'India\'s largest EMS player riding the PLI scheme wave. Samsung, Xiaomi, Google Pixel manufacturing contracts secured. Backward integration into PCB and sub-assemblies improving margins. FII holding increased by 3.2% last quarter.',
    key_risks: 'High PE valuation, customer concentration, PLI subsidy dependence, raw material import costs, forex risk.',
    entry_point: 'Rs. 12,500-13,000',
    stop_loss: 'Rs. 11,000',
    insider_activity: 'Promoter increased holding by 0.5% via creeping acquisition',
    catalyst: 'Apple ecosystem entry, PLI disbursements, IT hardware manufacturing expansion'
  },
  {
    rank: 3,
    ticker: 'CLEAN',
    company_name: 'Clean Science & Technology',
    sector: 'Chemicals',
    current_price: 'Rs. 1,520',
    target_price: 'Rs. 2,100',
    upside_percentage: '38.2%',
    composite_score: 8.5,
    fundamental_score: 9.0,
    technical_score: 8.0,
    sentiment_score: 8.5,
    risk_level: 'Low',
    market_cap: 'Rs. 16,100 Cr',
    pe_ratio: '48.3',
    revenue_growth: '22%',
    buy_rationale: 'Monopoly in MEHQ and BHA performance chemicals with 50%+ EBITDA margins. Unique catalytic process eliminates hazardous waste. Zero debt with Rs. 800 Cr cash. New capacity for HALS and guaiacol coming online FY26.',
    key_risks: 'Concentration in few product lines, raw material price volatility, new capacity utilization risk, global chemical demand slowdown.',
    entry_point: 'Rs. 1,480-1,540',
    stop_loss: 'Rs. 1,320',
    insider_activity: 'No insider selling; promoter holding at 55.2%',
    catalyst: 'New product launches, export market expansion, HALS capacity commissioning'
  },
  {
    rank: 4,
    ticker: 'KAYNES',
    company_name: 'Kaynes Technology',
    sector: 'Defence',
    current_price: 'Rs. 4,850',
    target_price: 'Rs. 7,200',
    upside_percentage: '48.5%',
    composite_score: 8.2,
    fundamental_score: 7.9,
    technical_score: 8.4,
    sentiment_score: 8.3,
    risk_level: 'High',
    market_cap: 'Rs. 27,600 Cr',
    pe_ratio: 'N/A',
    revenue_growth: '85%',
    buy_rationale: 'Full-stack ESDM company with OSAT semiconductor facility under construction. Defence orders growing at 100%+ with BEL/DRDO/HAL as key clients. Only listed Indian company with PCB-to-chip packaging capability. Order book at Rs. 4,200 Cr.',
    key_risks: 'High capex for OSAT facility, execution risk on semiconductor fab, defence order lumpy recognition, rich valuations.',
    entry_point: 'Rs. 4,700-4,900',
    stop_loss: 'Rs. 4,000',
    insider_activity: 'Promoter purchased Rs. 12 Cr in open market',
    catalyst: 'OSAT commissioning, defence order wins, semiconductor PLI benefits'
  },
  {
    rank: 5,
    ticker: 'MANKIND',
    company_name: 'Mankind Pharma',
    sector: 'Pharma',
    current_price: 'Rs. 2,380',
    target_price: 'Rs. 3,200',
    upside_percentage: '34.5%',
    composite_score: 7.9,
    fundamental_score: 8.3,
    technical_score: 7.6,
    sentiment_score: 7.8,
    risk_level: 'Low',
    market_cap: 'Rs. 95,200 Cr',
    pe_ratio: '38.5',
    revenue_growth: '18%',
    buy_rationale: 'India\'s 4th largest pharma company with dominant position in chronic therapies. BSV acquisition transforms consumer health portfolio. Pan-India distribution with 12,000+ field force covering 95% pin codes.',
    key_risks: 'BSV integration execution, NLEM price controls, competitive intensity in OTC segment, working capital stretch.',
    entry_point: 'Rs. 2,300-2,400',
    stop_loss: 'Rs. 2,050',
    insider_activity: 'DII increased holding by 2.1% last quarter',
    catalyst: 'BSV synergy realization, chronic therapy market share gains, OTC brand launches'
  }
]

const SAMPLE_ANALYSIS: AnalysisResult = {
  recommendations: SAMPLE_RECOMMENDATIONS,
  analysis_summary: 'Our multi-factor screening identified 5 high-conviction multibagger candidates from an initial universe of 1,847 NSE/BSE listed stocks. The Indian market environment favors companies with strong domestic consumption tailwinds, PLI scheme beneficiaries, and China+1 manufacturing themes. Best risk/reward in mid-cap growth names with high promoter holdings and proven execution.',
  market_outlook: 'NIFTY consolidating near all-time highs with FII flows turning positive. Sectoral rotation favoring domestic cyclicals and capex themes. Key risks include crude oil spikes, INR depreciation, and global risk-off events. Favor companies with pricing power, import substitution catalysts, and rising DII/FII ownership.',
  total_candidates_screened: 1847,
  analysis_date: '2025-02-15'
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-serif font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-serif font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-serif font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

// ─── Helper: Risk Badge ──────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const normalized = (level ?? '').toLowerCase()
  if (normalized === 'low') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">Low Risk</Badge>
  if (normalized === 'high') return <Badge className="bg-red-100 text-red-800 border-red-300 hover:bg-red-100">High Risk</Badge>
  return <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">Medium Risk</Badge>
}

// ─── Helper: Score Circle ────────────────────────────────────────────────────
function ScoreCircle({ score, label, size = 'md' }: { score: number; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = score ?? 0
  const dim = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14'
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-sm'
  const color = s >= 8 ? 'text-emerald-700' : s >= 6 ? 'text-amber-700' : 'text-red-700'
  const bgColor = s >= 8 ? 'bg-emerald-50 border-emerald-200' : s >= 6 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${dim} rounded-full ${bgColor} border-2 flex items-center justify-center`}>
        <span className={`${textSize} font-bold ${color}`}>{s.toFixed(1)}</span>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  )
}

// ─── Helper: Metric Row ──────────────────────────────────────────────────────
function MetricRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? 'N/A'}</span>
    </div>
  )
}

// ─── Helper: Stat Card ───────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-primary/10">{icon}</div>
          <div className="text-right">
            <p className="text-2xl font-serif font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Expandable Stock Card ───────────────────────────────────────────────────
function StockCard({
  rec,
  expanded,
  onToggle,
  selected,
  onSelect
}: {
  rec: Recommendation
  expanded: boolean
  onToggle: () => void
  selected: boolean
  onSelect: (checked: boolean) => void
}) {
  const upside = rec?.upside_percentage ?? '0%'
  const upsideNum = parseFloat(upside.replace('%', '').replace('+', ''))
  const isPositive = !isNaN(upsideNum) && upsideNum > 0

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-0">
        <div className="p-4 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-3">
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={selected} onCheckedChange={onSelect} />
            </div>
            <Badge className="bg-primary text-primary-foreground font-mono text-sm px-2.5 py-1 hover:bg-primary">{rec?.ticker ?? 'N/A'}</Badge>
            <div className="flex-1 min-w-0">
              <p className="font-serif font-semibold text-sm truncate">{rec?.company_name ?? 'Unknown'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs py-0 px-1.5">{rec?.sector ?? 'N/A'}</Badge>
                <span className="text-xs text-muted-foreground">#{rec?.rank ?? '-'}</span>
              </div>
            </div>
            <ScoreCircle score={rec?.composite_score ?? 0} label="Score" />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{rec?.current_price ?? 'N/A'}</p>
              <div className="flex items-center gap-1 justify-end">
                {isPositive ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-red-600" />}
                <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>{upside}</span>
              </div>
              <p className="text-xs text-muted-foreground">Target: {rec?.target_price ?? 'N/A'}</p>
            </div>
            <RiskBadge level={rec?.risk_level ?? 'Medium'} />
            <div className="ml-1">
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-4 border-t border-border/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Card className="shadow-none border-border/40">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="flex justify-around">
                    <ScoreCircle score={rec?.fundamental_score ?? 0} label="Fundamental" size="sm" />
                    <ScoreCircle score={rec?.technical_score ?? 0} label="Technical" size="sm" />
                    <ScoreCircle score={rec?.sentiment_score ?? 0} label="Sentiment" size="sm" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none border-border/40">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Key Metrics</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <MetricRow label="Market Cap" value={rec?.market_cap} />
                  <MetricRow label="P/E Ratio" value={rec?.pe_ratio} />
                  <MetricRow label="Revenue Growth" value={rec?.revenue_growth} />
                </CardContent>
              </Card>

              <Card className="shadow-none border-border/40">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Trade Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <MetricRow label="Entry Point" value={rec?.entry_point} />
                  <MetricRow label="Stop Loss" value={rec?.stop_loss} />
                  <MetricRow label="Current Price" value={rec?.current_price} />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <h4 className="font-serif font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" /> Buy Rationale
                </h4>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {renderMarkdown(rec?.buy_rationale ?? '')}
                </div>
              </div>
              <div>
                <h4 className="font-serif font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-destructive" /> Key Risks
                </h4>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {renderMarkdown(rec?.key_risks ?? '')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <h4 className="font-serif font-semibold text-sm mb-1 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" /> Insider Activity
                </h4>
                <p className="text-sm text-muted-foreground">{rec?.insider_activity ?? 'No data available'}</p>
              </div>
              <div>
                <h4 className="font-serif font-semibold text-sm mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" /> Catalyst
                </h4>
                <p className="text-sm text-muted-foreground">{rec?.catalyst ?? 'No catalyst identified'}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Page() {
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'recommendations' | 'history' | 'settings'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSample, setShowSample] = useState(false)

  // Dashboard state
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [marketCapRange, setMarketCapRange] = useState<number[]>([1])
  const [riskTolerance, setRiskTolerance] = useState<string>('Moderate')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Data state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [analysisSummary, setAnalysisSummary] = useState('')
  const [marketOutlook, setMarketOutlook] = useState('')
  const [totalScreened, setTotalScreened] = useState(0)
  const [analysisDate, setAnalysisDate] = useState('')
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(null)

  // Recommendations screen state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<string>('composite_score')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [sendingAlert, setSendingAlert] = useState(false)
  const [alertResult, setAlertResult] = useState<TeamsAlertResult | null>(null)

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Settings state
  const [teamId, setTeamId] = useState('')
  const [channelId, setChannelId] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [riskThreshold, setRiskThreshold] = useState<string>('all')
  const [minScoreFilter, setMinScoreFilter] = useState<number[]>([5])
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)

  // Active agent tracking
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // ── Load history from localStorage ────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('multibagger_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setHistory(parsed)
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // ── Load schedule on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function loadSchedule() {
      setScheduleLoading(true)
      const result = await getSchedule(SCHEDULE_ID)
      if (result.success && result.schedule) {
        setSchedule(result.schedule)
      }
      setScheduleLoading(false)
    }
    loadSchedule()
  }, [])

  // ── Sample data toggle effect ─────────────────────────────────────────────
  useEffect(() => {
    if (showSample && recommendations.length === 0) {
      setRecommendations(SAMPLE_ANALYSIS.recommendations)
      setAnalysisSummary(SAMPLE_ANALYSIS.analysis_summary)
      setMarketOutlook(SAMPLE_ANALYSIS.market_outlook)
      setTotalScreened(SAMPLE_ANALYSIS.total_candidates_screened)
      setAnalysisDate(SAMPLE_ANALYSIS.analysis_date)
      setLastAnalysisTime('Sample Data')
      setSelectedSectors(['IT Services', 'Pharma', 'Chemicals', 'Defence'])
    }
    if (!showSample && lastAnalysisTime === 'Sample Data') {
      setRecommendations([])
      setAnalysisSummary('')
      setMarketOutlook('')
      setTotalScreened(0)
      setAnalysisDate('')
      setLastAnalysisTime(null)
    }
  }, [showSample])

  // ── Save history to localStorage ──────────────────────────────────────────
  const saveHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, 50)
      try {
        localStorage.setItem('multibagger_history', JSON.stringify(updated))
      } catch {
        // ignore storage errors
      }
      return updated
    })
  }, [])

  // ── Run Analysis ──────────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (selectedSectors.length === 0) {
      setAnalysisError('Please select at least one sector to analyze.')
      return
    }
    setAnalyzing(true)
    setAnalysisError(null)
    setAnalysisProgress(0)
    setActiveAgentId(COORDINATOR_AGENT_ID)

    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + Math.random() * 8, 92))
    }, 800)

    const capLabel = MARKET_CAP_LABELS[marketCapRange[0] ?? 1] ?? 'Small (500-5,000 Cr)'
    const message = `Analyze Indian NSE/BSE listed stocks with the following screening criteria: Sectors: ${selectedSectors.join(', ')}. Market Cap Range: ${capLabel}. Risk Tolerance: ${riskTolerance}. Find multibagger candidates with strong fundamentals, technical momentum, and positive sentiment. Focus on promoter holdings, FII/DII activity, and SEBI compliance. Rank by composite score and provide detailed buy rationale with entry points in INR.`

    try {
      const result = await callAIAgent(message, COORDINATOR_AGENT_ID)
      clearInterval(progressInterval)
      setAnalysisProgress(100)

      if (result.success && result?.response?.status === 'success') {
        const data = result.response.result
        if (data && Array.isArray(data?.recommendations)) {
          setRecommendations(data.recommendations)
          setAnalysisSummary(data?.analysis_summary ?? '')
          setMarketOutlook(data?.market_outlook ?? '')
          setTotalScreened(data?.total_candidates_screened ?? 0)
          setAnalysisDate(data?.analysis_date ?? '')

          const now = new Date()
          const timeStr = now.toLocaleString()
          setLastAnalysisTime(timeStr)

          saveHistory({
            id: now.toISOString(),
            timestamp: timeStr,
            total_candidates_screened: data?.total_candidates_screened ?? 0,
            recommendations_count: data.recommendations.length,
            market_outlook: data?.market_outlook ?? '',
            analysis_summary: data?.analysis_summary ?? ''
          })
        } else {
          setAnalysisError('Agent returned unexpected data format. Please try again.')
        }
      } else {
        setAnalysisError(result?.response?.message ?? 'Analysis failed. Please try again.')
      }
    } catch {
      clearInterval(progressInterval)
      setAnalysisError('Network error. Please check your connection and try again.')
    } finally {
      setAnalyzing(false)
      setActiveAgentId(null)
    }
  }

  // ── Send to Teams ─────────────────────────────────────────────────────────
  const sendToTeams = async () => {
    const selected = recommendations.filter(r => selectedStocks.has(r?.ticker))
    if (selected.length === 0) return

    setSendingAlert(true)
    setAlertResult(null)
    setActiveAgentId(TEAMS_AGENT_ID)

    const stocksData = selected.map(s => ({
      ticker: s?.ticker,
      company_name: s?.company_name,
      composite_score: s?.composite_score,
      risk_level: s?.risk_level,
      current_price: s?.current_price,
      target_price: s?.target_price,
      upside_percentage: s?.upside_percentage,
      buy_rationale: s?.buy_rationale,
      entry_point: s?.entry_point,
      stop_loss: s?.stop_loss
    }))

    const message = `Send the following stock recommendations to Teams:\n${JSON.stringify(stocksData, null, 2)}`

    try {
      const result = await callAIAgent(message, TEAMS_AGENT_ID)
      if (result.success && result?.response?.status === 'success') {
        const data = result.response.result
        setAlertResult({
          delivery_status: data?.delivery_status ?? 'unknown',
          channel_name: data?.channel_name ?? '',
          message_preview: data?.message_preview ?? '',
          stocks_included: data?.stocks_included ?? selected.length,
          alert_type: data?.alert_type ?? 'manual',
          timestamp: data?.timestamp ?? ''
        })
      }
    } catch {
      // handled gracefully
    }
    setSendingAlert(false)
    setActiveAgentId(null)
  }

  // ── Test Teams Connection ─────────────────────────────────────────────────
  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus(null)
    setActiveAgentId(TEAMS_AGENT_ID)
    try {
      const message = `Test connection to Teams channel. Team ID: ${teamId || 'default'}. Channel ID: ${channelId || 'default'}. Send a test message confirming connectivity.`
      const result = await callAIAgent(message, TEAMS_AGENT_ID)
      if (result.success && result?.response?.status === 'success') {
        setConnectionStatus('success')
      } else {
        setConnectionStatus('error')
      }
    } catch {
      setConnectionStatus('error')
    }
    setTestingConnection(false)
    setActiveAgentId(null)
  }

  // ── Schedule Management ───────────────────────────────────────────────────
  const handleToggleSchedule = async () => {
    if (!schedule) return
    setScheduleLoading(true)
    setScheduleMessage(null)
    const result = schedule.is_active
      ? await pauseSchedule(schedule.id)
      : await resumeSchedule(schedule.id)
    if (result.success) {
      setSchedule(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
      setScheduleMessage(schedule.is_active ? 'Schedule paused successfully' : 'Schedule resumed successfully')
    } else {
      setScheduleMessage('Failed to update schedule')
    }
    setScheduleLoading(false)
  }

  const handleTriggerNow = async () => {
    setTriggerLoading(true)
    setScheduleMessage(null)
    const result = await triggerScheduleNow(SCHEDULE_ID)
    if (result.success) {
      setScheduleMessage('Schedule triggered successfully. Check logs for results.')
    } else {
      setScheduleMessage('Failed to trigger schedule')
    }
    setTriggerLoading(false)
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    const result = await getScheduleLogs(SCHEDULE_ID, { limit: 10 })
    if (result.success) {
      setScheduleLogs(result.executions)
    }
    setLogsLoading(false)
  }

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleSector = (sector: string) => {
    setSelectedSectors(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    )
  }

  const toggleExpand = (ticker: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  const toggleSelect = (ticker: string, checked: boolean) => {
    setSelectedStocks(prev => {
      const next = new Set(prev)
      if (checked) next.add(ticker)
      else next.delete(ticker)
      return next
    })
  }

  // ── Filter & sort recommendations ─────────────────────────────────────────
  const displayRecs = Array.isArray(recommendations) ? recommendations : []
  const filteredRecs = displayRecs
    .filter(r => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !q || (r?.ticker ?? '').toLowerCase().includes(q) || (r?.company_name ?? '').toLowerCase().includes(q)
      const matchesRisk = filterRisk === 'all' || (r?.risk_level ?? '').toLowerCase() === filterRisk.toLowerCase()
      return matchesSearch && matchesRisk
    })
    .sort((a, b) => {
      if (sortBy === 'composite_score') return (b?.composite_score ?? 0) - (a?.composite_score ?? 0)
      if (sortBy === 'upside') {
        const aUp = parseFloat((a?.upside_percentage ?? '0').replace('%', '').replace('+', ''))
        const bUp = parseFloat((b?.upside_percentage ?? '0').replace('%', '').replace('+', ''))
        return (isNaN(bUp) ? 0 : bUp) - (isNaN(aUp) ? 0 : aUp)
      }
      if (sortBy === 'risk') {
        const order: Record<string, number> = { low: 1, medium: 2, high: 3 }
        return (order[(a?.risk_level ?? 'medium').toLowerCase()] ?? 2) - (order[(b?.risk_level ?? 'medium').toLowerCase()] ?? 2)
      }
      return (a?.rank ?? 99) - (b?.rank ?? 99)
    })

  // ── Navigation Items ──────────────────────────────────────────────────────
  const navItems = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
    { key: 'recommendations' as const, label: 'Recommendations', icon: <TrendingUp className="w-4 h-4" />, count: displayRecs.length },
    { key: 'history' as const, label: 'History', icon: <Clock className="w-4 h-4" />, count: history.length },
    { key: 'settings' as const, label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ]

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/50 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-4 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-serif font-bold text-base leading-tight">MultiBagger</h1>
                <p className="text-xs text-muted-foreground leading-tight">Scout</p>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <nav className="flex-1 p-3">
            <div className="space-y-1">
              {navItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => { setActiveScreen(item.key); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${activeScreen === item.key ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-secondary'}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {(item.count ?? 0) > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs py-0 h-5">{item.count}</Badge>
                  )}
                </button>
              ))}
            </div>
          </nav>

          <div className="p-3 border-t border-border/30">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Agents</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${activeAgentId === COORDINATOR_AGENT_ID ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                <span className="truncate text-muted-foreground">Stock Coordinator</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${activeAgentId === TEAMS_AGENT_ID ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                <span className="truncate text-muted-foreground">Teams Alert</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="bg-card border-b border-border/50 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-serif font-semibold text-lg capitalize">{activeScreen}</h2>
            <div className="flex-1" />
            {lastAnalysisTime && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Last: {lastAnalysisTime}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground">Sample Data</Label>
              <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
            </div>
          </header>

          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">

              {/* ═══════════════════ DASHBOARD ═══════════════════ */}
              {activeScreen === 'dashboard' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                      icon={<Search className="w-5 h-5 text-primary" />}
                      label="Stocks Analyzed"
                      value={totalScreened > 0 ? totalScreened.toLocaleString() : '--'}
                      sub="Across all sectors"
                    />
                    <StatCard
                      icon={<Star className="w-5 h-5 text-primary" />}
                      label="Active Recommendations"
                      value={displayRecs.length || '--'}
                      sub="Multibagger candidates"
                    />
                    <StatCard
                      icon={<BarChart3 className="w-5 h-5 text-primary" />}
                      label="Analyses Completed"
                      value={history.length || '--'}
                      sub="All-time history"
                    />
                  </div>

                  {(analysisSummary || marketOutlook) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysisSummary && (
                        <Card className="shadow-sm">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-serif flex items-center gap-1.5">
                              <BarChart3 className="w-4 h-4 text-primary" /> Analysis Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent>{renderMarkdown(analysisSummary)}</CardContent>
                        </Card>
                      )}
                      {marketOutlook && (
                        <Card className="shadow-sm">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-serif flex items-center gap-1.5">
                              <Globe className="w-4 h-4 text-primary" /> Market Outlook
                            </CardTitle>
                          </CardHeader>
                          <CardContent>{renderMarkdown(marketOutlook)}</CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-serif text-lg">Screening Configuration</CardTitle>
                      <CardDescription>Configure your multibagger stock screening parameters</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <Label className="text-sm font-medium mb-3 block">Sectors</Label>
                        <div className="flex flex-wrap gap-2">
                          {SECTORS.map(sector => (
                            <button
                              key={sector}
                              onClick={() => toggleSector(sector)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 border ${selectedSectors.includes(sector) ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border/50 hover:bg-secondary/80'}`}
                            >
                              {sector}
                            </button>
                          ))}
                        </div>
                        {selectedSectors.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">{selectedSectors.length} sector{selectedSectors.length > 1 ? 's' : ''} selected</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-3 block">Market Cap Range</Label>
                        <div className="px-2">
                          <Slider
                            value={marketCapRange}
                            onValueChange={setMarketCapRange}
                            min={0}
                            max={3}
                            step={1}
                          />
                          <div className="flex justify-between mt-2">
                            {Object.values(MARKET_CAP_LABELS).map((lbl, i) => (
                              <span key={i} className={`text-xs ${marketCapRange[0] === i ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{lbl.split(' ')[0]}</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Selected: {MARKET_CAP_LABELS[marketCapRange[0] ?? 1]}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-3 block">Risk Tolerance</Label>
                        <div className="flex gap-2">
                          {RISK_LEVELS.map(level => (
                            <button
                              key={level}
                              onClick={() => setRiskTolerance(level)}
                              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 border ${riskTolerance === level ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border/50 hover:bg-secondary/80'}`}
                            >
                              {level === 'Conservative' && <Shield className="w-3.5 h-3.5 inline mr-1.5" />}
                              {level === 'Moderate' && <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" />}
                              {level === 'Aggressive' && <Zap className="w-3.5 h-3.5 inline mr-1.5" />}
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex-col items-stretch gap-3">
                      {analysisError && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{analysisError}</span>
                        </div>
                      )}
                      {analyzing && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Analyzing markets across {selectedSectors.length} sectors...</span>
                          </div>
                          <Progress value={analysisProgress} className="h-2" />
                        </div>
                      )}
                      <Button
                        onClick={runAnalysis}
                        disabled={analyzing || selectedSectors.length === 0}
                        className="w-full"
                        size="lg"
                      >
                        {analyzing ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Markets...</>
                        ) : (
                          <><Search className="w-4 h-4 mr-2" /> Run Analysis</>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>

                  {history.length > 0 && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-serif flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary" /> Recent Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {history.slice(0, 5).map((entry, i) => (
                            <div key={entry?.id ?? i} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">Screened {(entry?.total_candidates_screened ?? 0).toLocaleString()} stocks</p>
                                <p className="text-xs text-muted-foreground truncate">{entry?.recommendations_count ?? 0} recommendations found</p>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{entry?.timestamp ?? ''}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ═══════════════════ RECOMMENDATIONS ═══════════════════ */}
              {activeScreen === 'recommendations' && (
                <div className="space-y-4">
                  {displayRecs.length > 0 ? (
                    <>
                      <Card className="shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                placeholder="Search by ticker or company..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="composite_score">Score (High-Low)</SelectItem>
                                  <SelectItem value="upside">Upside (%)</SelectItem>
                                  <SelectItem value="risk">Risk (Low-High)</SelectItem>
                                  <SelectItem value="rank">Rank</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select value={filterRisk} onValueChange={setFilterRisk}>
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue placeholder="Risk" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Risk</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {selectedStocks.size > 0 && (
                        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <Check className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{selectedStocks.size} stock{selectedStocks.size > 1 ? 's' : ''} selected</span>
                          <div className="flex-1" />
                          <Button
                            variant="default"
                            size="sm"
                            onClick={sendToTeams}
                            disabled={sendingAlert}
                          >
                            {sendingAlert ? (
                              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending...</>
                            ) : (
                              <><Send className="w-3.5 h-3.5 mr-1.5" /> Send to Teams</>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedStocks(new Set())}
                          >
                            Clear
                          </Button>
                        </div>
                      )}

                      {alertResult && (
                        <Card className="shadow-sm border-emerald-200 bg-emerald-50/50">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <Check className="w-4 h-4 text-emerald-700" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-emerald-800">Alert Sent Successfully</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <p className="text-sm font-medium">{alertResult?.delivery_status ?? 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Channel</p>
                                    <p className="text-sm font-medium">{alertResult?.channel_name || 'Default'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Stocks</p>
                                    <p className="text-sm font-medium">{alertResult?.stocks_included ?? 0}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Type</p>
                                    <p className="text-sm font-medium">{alertResult?.alert_type ?? 'N/A'}</p>
                                  </div>
                                </div>
                                {alertResult?.message_preview && (
                                  <div className="mt-2">
                                    <p className="text-xs text-muted-foreground">Preview</p>
                                    <p className="text-xs mt-0.5 text-emerald-700 line-clamp-2">{alertResult.message_preview}</p>
                                  </div>
                                )}
                                {alertResult?.timestamp && (
                                  <div className="mt-1">
                                    <p className="text-xs text-muted-foreground">Sent: {alertResult.timestamp}</p>
                                  </div>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setAlertResult(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <div className="space-y-3">
                        {filteredRecs.map(rec => (
                          <StockCard
                            key={rec?.ticker ?? Math.random().toString()}
                            rec={rec}
                            expanded={expandedCards.has(rec?.ticker ?? '')}
                            onToggle={() => toggleExpand(rec?.ticker ?? '')}
                            selected={selectedStocks.has(rec?.ticker ?? '')}
                            onSelect={(checked) => toggleSelect(rec?.ticker ?? '', !!checked)}
                          />
                        ))}
                      </div>

                      {filteredRecs.length === 0 && displayRecs.length > 0 && (
                        <Card className="shadow-sm">
                          <CardContent className="p-8 text-center">
                            <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                            <p className="font-serif font-semibold">No matches found</p>
                            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <Card className="shadow-sm">
                      <CardContent className="p-12 text-center">
                        <TrendingUp className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="font-serif font-semibold text-lg">No Recommendations Yet</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                          Run a stock analysis from the Dashboard to discover multibagger candidates.
                        </p>
                        <Button className="mt-4" onClick={() => setActiveScreen('dashboard')}>
                          <Search className="w-4 h-4 mr-2" /> Go to Dashboard
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ═══════════════════ HISTORY ═══════════════════ */}
              {activeScreen === 'history' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard
                      icon={<BarChart3 className="w-5 h-5 text-primary" />}
                      label="Total Analyses"
                      value={history.length || '--'}
                    />
                    <StatCard
                      icon={<Star className="w-5 h-5 text-primary" />}
                      label="Avg Recommendations"
                      value={
                        history.length > 0
                          ? (history.reduce((sum, h) => sum + (h?.recommendations_count ?? 0), 0) / history.length).toFixed(1)
                          : '--'
                      }
                      sub="Per analysis run"
                    />
                  </div>

                  {history.length > 0 ? (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="font-serif text-base">Analysis History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs text-right">Screened</TableHead>
                                <TableHead className="text-xs text-right">Recommendations</TableHead>
                                <TableHead className="text-xs hidden md:table-cell">Market Outlook</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {history.map((entry, i) => (
                                <TableRow key={entry?.id ?? i}>
                                  <TableCell className="text-sm whitespace-nowrap">{entry?.timestamp ?? 'N/A'}</TableCell>
                                  <TableCell className="text-sm text-right font-medium">{(entry?.total_candidates_screened ?? 0).toLocaleString()}</TableCell>
                                  <TableCell className="text-sm text-right">
                                    <Badge variant="secondary">{entry?.recommendations_count ?? 0}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate">{entry?.market_outlook ?? 'N/A'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="shadow-sm">
                      <CardContent className="p-12 text-center">
                        <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="font-serif font-semibold text-lg">No History Yet</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                          Your analysis history will appear here after you run your first screening.
                        </p>
                        <Button className="mt-4" onClick={() => setActiveScreen('dashboard')}>
                          <Search className="w-4 h-4 mr-2" /> Run First Analysis
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {history.length > 0 && history[0]?.analysis_summary && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="font-serif text-base">Latest Analysis Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderMarkdown(history[0].analysis_summary)}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ═══════════════════ SETTINGS ═══════════════════ */}
              {activeScreen === 'settings' && (
                <div className="space-y-6">
                  {/* Teams Configuration */}
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-serif text-base flex items-center gap-2">
                        <Send className="w-4 h-4 text-primary" /> Teams Configuration
                      </CardTitle>
                      <CardDescription>Configure your Microsoft Teams integration for stock alerts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="team-id" className="text-sm">Team ID</Label>
                          <Input
                            id="team-id"
                            placeholder="Enter your Team ID"
                            value={teamId}
                            onChange={(e) => setTeamId(e.target.value)}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="channel-id" className="text-sm">Channel ID</Label>
                          <Input
                            id="channel-id"
                            placeholder="Enter your Channel ID"
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={testConnection} disabled={testingConnection}>
                          {testingConnection ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</>
                          ) : (
                            <><Zap className="w-4 h-4 mr-2" /> Test Connection</>
                          )}
                        </Button>
                        {connectionStatus === 'success' && (
                          <div className="flex items-center gap-1.5 text-sm text-emerald-700">
                            <Check className="w-4 h-4" /> Connected
                          </div>
                        )}
                        {connectionStatus === 'error' && (
                          <div className="flex items-center gap-1.5 text-sm text-destructive">
                            <AlertCircle className="w-4 h-4" /> Connection failed
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Schedule Management */}
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-serif text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" /> Schedule Management
                      </CardTitle>
                      <CardDescription>Manage the weekly stock analysis schedule</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {scheduleLoading && !schedule ? (
                        <div className="space-y-3">
                          <Skeleton className="h-6 w-48" />
                          <Skeleton className="h-4 w-72" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : schedule ? (
                        <>
                          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${schedule.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                                <span className="text-sm font-medium">{schedule.is_active ? 'Active' : 'Paused'}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {schedule.cron_expression ? cronToHuman(schedule.cron_expression) : 'No schedule set'}
                                {schedule.timezone ? ` (${schedule.timezone})` : ''}
                              </p>
                            </div>
                            <Switch
                              checked={schedule.is_active}
                              onCheckedChange={handleToggleSchedule}
                              disabled={scheduleLoading}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-secondary/30 rounded-lg">
                              <p className="text-xs text-muted-foreground">Cron Expression</p>
                              <p className="text-sm font-mono font-medium mt-0.5">{schedule.cron_expression ?? 'N/A'}</p>
                            </div>
                            <div className="p-3 bg-secondary/30 rounded-lg">
                              <p className="text-xs text-muted-foreground">Next Run</p>
                              <p className="text-sm font-medium mt-0.5">{schedule.next_run_time ? new Date(schedule.next_run_time).toLocaleString() : 'N/A'}</p>
                            </div>
                            <div className="p-3 bg-secondary/30 rounded-lg">
                              <p className="text-xs text-muted-foreground">Last Run</p>
                              <p className="text-sm font-medium mt-0.5">
                                {schedule.last_run_at ? new Date(schedule.last_run_at).toLocaleString() : 'Never'}
                                {schedule.last_run_success !== null && schedule.last_run_success !== undefined && (
                                  <Badge variant="secondary" className={`ml-2 text-xs ${schedule.last_run_success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {schedule.last_run_success ? 'Success' : 'Failed'}
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleTriggerNow} disabled={triggerLoading}>
                              {triggerLoading ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Triggering...</>
                              ) : (
                                <><Play className="w-3.5 h-3.5 mr-1.5" /> Run Now</>
                              )}
                            </Button>
                            <Button variant="outline" size="sm" onClick={loadLogs} disabled={logsLoading}>
                              {logsLoading ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading...</>
                              ) : (
                                <><Clock className="w-3.5 h-3.5 mr-1.5" /> View Logs</>
                              )}
                            </Button>
                          </div>

                          {scheduleMessage && (
                            <div className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/50">
                              <Check className="w-4 h-4 text-primary" />
                              <span>{scheduleMessage}</span>
                            </div>
                          )}

                          {scheduleLogs.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Execution History</h4>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Time</TableHead>
                                      <TableHead className="text-xs">Status</TableHead>
                                      <TableHead className="text-xs">Attempt</TableHead>
                                      <TableHead className="text-xs hidden md:table-cell">Details</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {scheduleLogs.map((log, i) => (
                                      <TableRow key={log?.id ?? i}>
                                        <TableCell className="text-xs whitespace-nowrap">{log?.executed_at ? new Date(log.executed_at).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className={`text-xs ${log?.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {log?.success ? 'Success' : 'Failed'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">{log?.attempt ?? 1}/{log?.max_attempts ?? 1}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate">{log?.error_message ?? log?.payload_message ?? ''}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Unable to load schedule. Please try refreshing.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={async () => {
                              setScheduleLoading(true)
                              const result = await getSchedule(SCHEDULE_ID)
                              if (result.success && result.schedule) setSchedule(result.schedule)
                              setScheduleLoading(false)
                            }}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Alert Preferences */}
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-serif text-base flex items-center gap-2">
                        <Filter className="w-4 h-4 text-primary" /> Alert Preferences
                      </CardTitle>
                      <CardDescription>Filter which recommendations trigger Teams alerts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm">Risk Threshold</Label>
                        <Select value={riskThreshold} onValueChange={setRiskThreshold}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select risk level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Risk Levels</SelectItem>
                            <SelectItem value="low">Low Risk Only</SelectItem>
                            <SelectItem value="medium">Low & Medium Risk</SelectItem>
                            <SelectItem value="high">All (Including High Risk)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Minimum Composite Score</Label>
                        <div className="px-2 mt-3">
                          <Slider
                            value={minScoreFilter}
                            onValueChange={setMinScoreFilter}
                            min={1}
                            max={10}
                            step={0.5}
                          />
                          <div className="flex justify-between mt-2">
                            <span className="text-xs text-muted-foreground">1</span>
                            <span className="text-sm font-medium text-primary">{minScoreFilter[0]}</span>
                            <span className="text-xs text-muted-foreground">10</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Only stocks scoring {minScoreFilter[0]}+ will be included in alerts</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Agent Info */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-serif text-base flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" /> Agent Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeAgentId === COORDINATOR_AGENT_ID ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Stock Analysis Coordinator</p>
                            <p className="text-xs text-muted-foreground">Coordinates fundamental, technical, and sentiment analysis of NSE/BSE listed Indian stocks. Produces ranked multibagger candidates with INR pricing.</p>
                          </div>
                          <Badge variant="outline" className="text-xs font-mono flex-shrink-0">Manager</Badge>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeAgentId === TEAMS_AGENT_ID ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Teams Alert Agent</p>
                            <p className="text-xs text-muted-foreground">Formats and delivers Indian stock recommendations to Microsoft Teams channels with structured alerts in INR.</p>
                          </div>
                          <Badge variant="outline" className="text-xs font-mono flex-shrink-0">Scheduled</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  )
}
