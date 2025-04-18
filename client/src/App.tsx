import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import CreateEvent from "@/pages/CreateEvent";
import EventDetail from "@/pages/EventDetail";
import EventAttendance from "@/pages/EventAttendance";
import ExpenseSplitting from "@/pages/ExpenseSplitting";
import MainLayout from "./components/layout/MainLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create" component={CreateEvent} />
      <Route path="/event/:id" component={EventDetail} />
      <Route path="/event/:id/attendance" component={EventAttendance} />
      <Route path="/event/:id/expenses" component={ExpenseSplitting} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <MainLayout>
          <Router />
        </MainLayout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
