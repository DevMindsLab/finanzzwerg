import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import DashboardPage from "@/pages/DashboardPage";
import InboxPage from "@/pages/InboxPage";
import TransactionsPage from "@/pages/TransactionsPage";
import RulesPage from "@/pages/RulesPage";
import CategoriesPage from "@/pages/CategoriesPage";
import ImportPage from "@/pages/ImportPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="import" element={<ImportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
