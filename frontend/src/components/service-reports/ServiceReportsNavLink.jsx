import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || ""}/api/service-reports`,
  withCredentials: true,
  timeout: 10000,
});
export function ServiceReportsNavLink({ className, style, onClick }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    api
      .get("/capabilities")
      .then((r) => setAllowed(r.data.capabilities.includes("view")))
      .catch(() => setAllowed(false));
  }, []);
  return allowed ? (
    <Link
      to="/operations/service-reports"
      className={className}
      style={style}
      onClick={onClick}
    >
      Service Reports
    </Link>
  ) : null;
}
