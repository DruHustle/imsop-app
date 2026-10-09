import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Truck, 
  Package, 
  MapPin,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { exportShipmentsToCSV, exportShipmentsToPDF, type ShipmentData } from "@/lib/export";
import { useEffect, useMemo, useState } from "react";
import { safeLocalStorage } from "@/lib/storage";
import { MapView } from "@/components/Map";

type LogisticsShipment = ShipmentData & { type: string; latitude?: number; longitude?: number };

const demoShipments: LogisticsShipment[] = [
  {
    id: "SHP-8829",
    origin: "Hamburg, DE",
    destination: "New York, US",
    status: "Delivered",
    carrier: "Maersk",
    eta: "2023-10-24",
    type: "Sea Freight",
    weight: "12,500 kg",
    value: "$45,000", latitude: 40.7128, longitude: -74.0060
  },
  {
    id: "SHP-9921",
    origin: "Shanghai, CN",
    destination: "Los Angeles, US",
    status: "In Transit",
    carrier: "COSCO",
    eta: "2023-11-02",
    type: "Sea Freight",
    weight: "8,200 kg",
    value: "$32,000", latitude: 34.0522, longitude: -118.2437
  },
  {
    id: "SHP-1002",
    origin: "Tokyo, JP",
    destination: "San Francisco, US",
    status: "Delayed",
    carrier: "ONE",
    eta: "2023-11-05",
    type: "Air Freight",
    weight: "1,500 kg",
    value: "$78,000", latitude: 37.7749, longitude: -122.4194
  },
  {
    id: "SHP-3321",
    origin: "London, UK",
    destination: "Dubai, UAE",
    status: "Processing",
    carrier: "DHL",
    eta: "2023-10-30",
    type: "Air Freight",
    weight: "850 kg",
    value: "$15,000", latitude: 25.2048, longitude: 55.2708
  },
  {
    id: "SHP-4452",
    origin: "Mumbai, IN",
    destination: "Singapore, SG",
    status: "In Transit",
    carrier: "FedEx",
    eta: "2023-10-28",
    type: "Air Freight",
    weight: "2,100 kg",
    value: "$28,000", latitude: 1.3521, longitude: 103.8198
  },
  {
    id: "SHP-5567",
    origin: "Rotterdam, NL",
    destination: "Sydney, AU",
    status: "In Transit",
    carrier: "Hapag-Lloyd",
    eta: "2023-11-15",
    type: "Sea Freight",
    weight: "25,000 kg",
    value: "$120,000", latitude: -33.8688, longitude: 151.2093
  },
  {
    id: "SHP-6678",
    origin: "Seoul, KR",
    destination: "Vancouver, CA",
    status: "Delivered",
    carrier: "Evergreen",
    eta: "2023-10-20",
    type: "Sea Freight",
    weight: "18,000 kg",
    value: "$95,000", latitude: 49.2827, longitude: -123.1207
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "Delivered": return "bg-green-500/20 text-green-400 border-green-500/50";
    case "In Transit": return "bg-blue-500/20 text-blue-400 border-blue-500/50";
    case "Delayed": return "bg-red-500/20 text-red-400 border-red-500/50";
    case "Processing": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/50";
  }
};

export default function Operations() {
  const [shipments, setShipments] = useState<LogisticsShipment[]>(demoShipments);
  const [query, setQuery] = useState("");
  const [dataSource, setDataSource] = useState<"demo" | "live" | "error">("demo");

  useEffect(() => {
    const token = safeLocalStorage.getItem('imsop_token');
    if (token?.startsWith('mock_')) return;
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    fetch(`${baseUrl}/api/operations/shipments`, { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json();
      })
      .then((rows: any[]) => {
        setShipments(rows.map(row => ({
          id: row.trackingNumber ?? row.tracking_number ?? String(row.id),
          origin: row.origin,
          destination: row.destination,
          status: row.status,
          carrier: row.carrier ?? 'Unassigned',
          eta: row.estimatedArrival ?? row.estimated_arrival ?? 'Not scheduled',
          type: row.type ?? 'Freight',
          weight: row.weight ?? 'Not reported',
          value: row.value ?? 'Not reported',
          latitude: row.latitude == null ? undefined : Number(row.latitude),
          longitude: row.longitude == null ? undefined : Number(row.longitude),
        })));
        setDataSource('live');
      })
      .catch(error => {
        console.error('Unable to load logistics assets', error);
        setShipments([]);
        setDataSource('error');
      });
  }, []);

  const visibleShipments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? shipments.filter(shipment => Object.values(shipment).some(value => String(value).toLowerCase().includes(normalized))) : shipments;
  }, [query, shipments]);
  const handleExportCSV = () => {
    const exportData: ShipmentData[] = shipments.map(s => ({
      id: s.id,
      origin: s.origin,
      destination: s.destination,
      status: s.status,
      carrier: s.carrier,
      eta: s.eta,
      weight: s.weight,
      value: s.value,
    }));
    exportShipmentsToCSV(exportData, `shipments-${new Date().toISOString().split('T')[0]}`);
    toast.success("CSV exported successfully", {
      description: "Your shipments data has been downloaded."
    });
  };

  const handleExportPDF = () => {
    const exportData: ShipmentData[] = shipments.map(s => ({
      id: s.id,
      origin: s.origin,
      destination: s.destination,
      status: s.status,
      carrier: s.carrier,
      eta: s.eta,
      weight: s.weight,
      value: s.value,
    }));
    exportShipmentsToPDF(exportData, "IMSOP Shipments Report");
    toast.success("PDF export initiated", {
      description: "Your report will open in a new window for printing."
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            Operations Center
          </h1>
          <p className="text-muted-foreground mt-1">Manage shipments, orders, and logistics assets.</p>
          <p className={dataSource === 'error' ? 'text-xs text-red-400 mt-1' : 'text-xs text-green-400 mt-1'} role="status">
            {dataSource === 'live' ? 'Connected to live logistics API' : dataSource === 'demo' ? 'Demo logistics data' : 'Logistics API unavailable'}
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="glass border-white/10 hover:bg-white/5">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass border-white/10">
              <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button disabled title="Shipment creation requires a connected production logistics provider" className="bg-primary text-primary-foreground">
            New Shipment
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass border-white/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Shipments</p>
              <h3 className="text-2xl font-bold font-display">1,284</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Orders</p>
              <h3 className="text-2xl font-bold font-display">342</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical Alerts</p>
              <h3 className="text-2xl font-bold font-display">5</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/5 overflow-hidden">
        <CardHeader><CardTitle className="font-display tracking-wide">Logistics Asset Map</CardTitle></CardHeader>
        <CardContent className="p-0 h-[280px] sm:h-[360px]">
          <MapView className="h-full" assets={visibleShipments.flatMap(shipment =>
            shipment.latitude == null || shipment.longitude == null ? [] : [{
              id: shipment.id, label: shipment.status,
              position: { lat: shipment.latitude, lng: shipment.longitude },
            }]
          )} />
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="glass border-white/5">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardTitle className="font-display tracking-wide">Recent Shipments</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder="Search shipments..." 
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="pl-9 bg-white/5 border-white/10 focus:border-primary/50"
                />
              </div>
              <Button variant="outline" size="icon" className="glass border-white/10">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Shipment ID</TableHead>
                  <TableHead className="text-muted-foreground">Origin</TableHead>
                  <TableHead className="text-muted-foreground">Destination</TableHead>
                  <TableHead className="text-muted-foreground">Carrier</TableHead>
                  <TableHead className="text-muted-foreground">ETA</TableHead>
                  <TableHead className="text-muted-foreground">Weight</TableHead>
                  <TableHead className="text-muted-foreground">Value</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleShipments.map((shipment) => (
                  <TableRow key={shipment.id} className="border-white/10 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium font-mono text-primary">{shipment.id}</TableCell>
                    <TableCell>{shipment.origin}</TableCell>
                    <TableCell>{shipment.destination}</TableCell>
                    <TableCell>{shipment.carrier}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {shipment.eta}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{shipment.weight}</TableCell>
                    <TableCell className="font-medium">{shipment.value}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(shipment.status)}>
                        {shipment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="hover:bg-white/10 hover:text-primary">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
