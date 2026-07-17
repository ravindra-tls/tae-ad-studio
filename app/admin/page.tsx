import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ImageIcon, Package } from 'lucide-react';
import {
  DashboardMainSection,
  DashboardSummarySection,
} from './dashboard-sections';

export default function AdminDashboard() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-forest">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-brand-slate">
            Monitor generation activity, product coverage, and incoming team requests in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/gallery">
            <Button variant="outline" className="gap-2">
              <ImageIcon className="h-4 w-4" /> View all images
            </Button>
          </Link>
          <Link href="/admin/products">
            <Button className="gap-2">
              <Package className="h-4 w-4" /> Manage products
            </Button>
          </Link>
        </div>
      </div>

      <DashboardSummarySection />
      <DashboardMainSection />
    </div>
  );
}
