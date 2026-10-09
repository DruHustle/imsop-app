import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function Forbidden() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4" role="alert">
      <ShieldX className="h-14 w-14 text-amber-400" />
      <h1 className="text-3xl font-bold">Access denied</h1>
      <p className="text-muted-foreground max-w-md">Your role does not have permission to access this area.</p>
      <Button onClick={() => navigate('/')}>Return to dashboard</Button>
    </div>
  );
}
