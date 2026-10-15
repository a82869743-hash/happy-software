import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 ml-0 lg:ml-[260px] min-h-screen flex flex-col transition-all duration-300 min-w-0 overflow-hidden">
        <TopBar onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />
        <main className="flex-1 pt-[72px] min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

