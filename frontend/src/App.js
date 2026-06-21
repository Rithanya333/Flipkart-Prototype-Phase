import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Executive from "@/pages/Executive";
import HotspotMap from "@/pages/HotspotMap";
import Predictions from "@/pages/Predictions";
import Enforcement from "@/pages/Enforcement";
import Analytics from "@/pages/Analytics";
import Simulator from "@/pages/Simulator";
import UploadData from "@/pages/Upload";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/executive" replace />} />
            <Route path="executive" element={<Executive />} />
            <Route path="map" element={<HotspotMap />} />
            <Route path="predictions" element={<Predictions />} />
            <Route path="enforcement" element={<Enforcement />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="simulator" element={<Simulator />} />
            <Route
              path="upload"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <UploadData />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster theme="dark" position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
