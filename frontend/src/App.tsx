import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ScrollToTop from './components/shared/ScrollToTop';
import ToastContainer from './components/shared/Toast';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobCards from './pages/JobCards';
import JobCardNew from './pages/JobCardNew';
import JobCardEdit from './pages/JobCardEdit';
import CarWash from './pages/CarWash';
import PrintView from './pages/PrintView';
import InvoiceTemplate from './pages/InvoiceTemplate';
import AccessoryInvoice from './pages/AccessoryInvoice';
import Staff from './pages/Staff';
import Attendance from './pages/Attendance';
import Salary from './pages/Salary';
import RecycleBin from './pages/RecycleBin';
import ProductSell from './pages/ProductSell';
import Accounts from './pages/Accounts';
import DailyReport from './pages/DailyReport';
import Parts from './pages/Parts';
import Exports from './pages/Exports';
import PublicJobCardView from './pages/PublicJobCardView';
import PublicDocView from './pages/PublicDocView';
import CustomerPayments from './pages/CustomerPayments';
import DataImport from './pages/DataImport';
import EstimateJobs from './pages/EstimateJobs';
import SmsSettings from './pages/SmsSettings';
import SuperAdmin from './pages/SuperAdmin';
import ServiceBookings from './pages/ServiceBookings';
import StatusBoard from './pages/StatusBoard';
import { useScreenProtection } from './utils/useScreenProtection';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const hasSavedToken = !!localStorage.getItem('gms_token');
  
  if (!isAuthenticated && !hasSavedToken) {
    return <Navigate to="/login" replace />;
  }

  if (user) {
    const role = user.role || 'admin';
    const path = location.pathname;

    // 1. Technician: ONLY dashboard and attendance (and printing)
    if (role === 'technician') {
      const allowedPaths = ['/dashboard', '/attendance', '/print/', '/invoice/'];
      const isAllowed = allowedPaths.some(p => path === p || path.startsWith(p));
      if (!isAllowed) {
        return <Navigate to="/dashboard" replace />;
      }
    }

    // 2. Service Advisor: ALL except super admin
    if (role === 'service_advisor') {
      if (path === '/super-admin' || path.startsWith('/super-admin/')) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return <>{children}</>;
}

export default function App() {
  useScreenProtection();

  return (
    <ThemeProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/track/:token" element={<PublicJobCardView />} />
          <Route path="/view/:token" element={<PublicDocView />} />

          {/* Print view — standalone page outside Layout */}
          <Route
            path="/print/:id"
            element={
              <ProtectedRoute>
                <PrintView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoice/:id"
            element={
              <ProtectedRoute>
                <InvoiceTemplate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoice/accessory/:id"
            element={
              <ProtectedRoute>
                <AccessoryInvoice />
              </ProtectedRoute>
            }
          />

          {/* Protected routes inside Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/job-cards" element={<JobCards />} />
            <Route path="/detailing-studio" element={<JobCards />} />
            <Route path="/job-cards/new" element={<JobCardNew />} />
            <Route path="/detailing-studio/new" element={<JobCardNew />} />
            <Route path="/job-cards/:id/edit" element={<JobCardEdit />} />
            <Route path="/detailing-studio/:id/edit" element={<JobCardEdit />} />
            <Route path="/car-wash" element={<CarWash />} />
            <Route path="/car-wash/new" element={<CarWash />} />
            <Route path="/car-wash/:id/edit" element={<CarWash />} />
            <Route path="/car-wash/:id" element={<CarWash />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/salary" element={<Salary />} />
            <Route path="/recycle-bin" element={<RecycleBin />} />
            <Route path="/product-sell" element={<ProductSell />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/daily-report" element={<DailyReport />} />
            <Route path="/daily report" element={<DailyReport />} />
            <Route path="/daily%20report" element={<DailyReport />} />
            <Route path="/parts" element={<Parts />} />
            <Route path="/exports" element={<Exports />} />
            <Route path="/estimate-jobs" element={<EstimateJobs />} />
            <Route path="/customer-payments" element={<CustomerPayments defaultView="history" />} />
            <Route path="/payment-pending" element={<CustomerPayments defaultView="outstanding" />} />
            <Route path="/data-import" element={<DataImport />} />
            <Route path="/service-bookings" element={<ServiceBookings />} />
            <Route path="/status-board" element={<StatusBoard />} />
            <Route path="/settings/sms" element={<SmsSettings />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ThemeProvider>
  );
}
