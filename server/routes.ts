import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all events
  app.get("/api/events", async (req, res) => {
    const events = await storage.getAllEvents();
    res.json(events);
  });

  // Create a new event
  app.post("/api/events", async (req, res) => {
    try {
      const eventSchema = z.object({
        title: z.string().min(1, "タイトルを入力してください"),
        description: z.string().optional(),
        creatorName: z.string().min(1, "お名前を入力してください"),
        defaultStartTime: z.string().min(1, "デフォルト開始時間を入力してください"),
        defaultEndTime: z.string().min(1, "デフォルト終了時間を入力してください"),
        dateOptions: z.array(z.object({
          date: z.string(), // yyyy-MM-dd format
          startTime: z.string().optional(), // HH:mm format, optional if using default
          endTime: z.string().optional(), // HH:mm format, optional if using default
          useDefaultTime: z.boolean().default(true)
        })).min(1, "少なくとも1つの日程を選択してください"),
      });

      const validatedData = eventSchema.parse(req.body);
      
      // Generate a unique ID for the event
      const eventId = nanoid();
      
      // Create event
      const event = await storage.createEvent({
        id: eventId,
        title: validatedData.title,
        description: validatedData.description || "",
        creatorName: validatedData.creatorName,
        defaultStartTime: validatedData.defaultStartTime,
        defaultEndTime: validatedData.defaultEndTime,
      });
      
      // Create date options
      const dateOptions = await Promise.all(
        validatedData.dateOptions.map(option => {
          // 個別の時間設定がない場合はデフォルト時間を使用
          const startTime = option.useDefaultTime ? validatedData.defaultStartTime : (option.startTime || validatedData.defaultStartTime);
          const endTime = option.useDefaultTime ? validatedData.defaultEndTime : (option.endTime || validatedData.defaultEndTime);
          
          return storage.createDateOption({
            id: nanoid(),
            eventId: eventId,
            date: option.date,
            startTime,
            endTime,
          });
        })
      );
      
      res.status(201).json({ 
        ...event, 
        dateOptions 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "イベントの作成に失敗しました" });
      }
    }
  });

  // Get a single event by ID
  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "イベントの取得に失敗しました" });
    }
  });

  // Finalize an event date
  app.post("/api/events/:id/finalize", async (req, res) => {
    try {
      const schema = z.object({
        dateOptionId: z.string().min(1, "日程を選択してください"),
      });

      const { dateOptionId } = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      const dateOption = event.dateOptions.find(option => option.id === dateOptionId);
      if (!dateOption) {
        return res.status(404).json({ message: "指定された日程が見つかりません" });
      }
      
      // Update the event with the selected date
      const updatedEvent = await storage.updateEvent(req.params.id, {
        selectedDate: dateOption.date,
        startTime: dateOption.startTime,
        endTime: dateOption.endTime,
      });
      
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "日程の確定に失敗しました" });
      }
    }
  });

  // Get all attendances for an event
  app.get("/api/events/:id/attendances", async (req, res) => {
    try {
      const attendances = await storage.getEventAttendances(req.params.id);
      res.json(attendances);
    } catch (error) {
      res.status(500).json({ message: "出欠情報の取得に失敗しました" });
    }
  });

  // Create or update an attendance
  app.post("/api/events/:id/attendances", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1, "お名前を入力してください"),
        responses: z.array(z.object({
          dateOptionId: z.string(),
          status: z.enum(["available", "maybe", "unavailable"]),
        })).min(1),
      });

      const validatedData = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      // 新しい出席情報を作成
      const attendanceId = nanoid();
      const attendance = await storage.createAttendance({
        id: attendanceId,
        eventId: req.params.id,
        name: validatedData.name,
      });
      
      // Create responses
      await Promise.all(
        validatedData.responses.map(response => 
          storage.createAttendanceResponse({
            attendanceId: attendanceId,
            dateOptionId: response.dateOptionId,
            status: response.status,
          })
        )
      );
      
      // Update participant count
      await storage.updateEvent(req.params.id, {
        participantsCount: (event.participantsCount || 0) + 1,
      });
      
      res.status(201).json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "出欠情報の保存に失敗しました" });
      }
    }
  });

  // Get all expenses for an event
  app.get("/api/events/:id/expenses", async (req, res) => {
    try {
      const expenses = await storage.getEventExpenses(req.params.id);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "支払い情報の取得に失敗しました" });
    }
  });

  // Create a new expense
  app.post("/api/events/:id/expenses", async (req, res) => {
    try {
      const schema = z.object({
        payerName: z.string().min(1, "支払者名を入力してください"),
        description: z.string().min(1, "項目を入力してください"),
        amount: z.number().positive("金額は0より大きい値を入力してください"),
      });

      const validatedData = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      if (!event.selectedDate) {
        return res.status(400).json({ message: "イベントの日程が確定していないため、精算機能は利用できません" });
      }
      
      const expense = await storage.createExpense({
        id: nanoid(),
        eventId: req.params.id,
        payerName: validatedData.payerName,
        description: validatedData.description,
        amount: String(validatedData.amount),
      });
      
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "支払い情報の保存に失敗しました" });
      }
    }
  });

  // Delete an expense
  app.delete("/api/events/:eventId/expenses/:expenseId", async (req, res) => {
    try {
      const { eventId, expenseId } = req.params;
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      await storage.deleteExpense(expenseId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "支払い情報の削除に失敗しました" });
    }
  });

  // Get settlements for an event
  app.get("/api/events/:id/settlements", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      if (!event.selectedDate) {
        return res.status(400).json({ message: "イベントの日程が確定していないため、精算機能は利用できません" });
      }
      
      const expenses = await storage.getEventExpenses(req.params.id);
      const settlements = calculateSettlements(expenses);
      
      res.json(settlements);
    } catch (error) {
      res.status(500).json({ message: "精算情報の計算に失敗しました" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function calculateSettlements(expenses: any[]): { from: string; to: string; amount: number }[] {
  if (!expenses.length) return [];
  
  // Calculate how much each person paid
  const payments: { [key: string]: number } = {};
  let totalAmount = 0;
  
  expenses.forEach(expense => {
    payments[expense.payerName] = (payments[expense.payerName] || 0) + Number(expense.amount);
    totalAmount += Number(expense.amount);
  });
  
  const participants = Object.keys(payments);
  const perPersonAmount = totalAmount / participants.length;
  
  // Calculate how much each person should pay or receive
  const balances: { [key: string]: number } = {};
  
  participants.forEach(person => {
    balances[person] = payments[person] - perPersonAmount;
  });
  
  // Generate settlements
  const settlements: { from: string; to: string; amount: number }[] = [];
  
  // Sort participants by balance (descending)
  const sortedParticipants = [...participants].sort((a, b) => balances[b] - balances[a]);
  
  // Find payers (negative balance) and receivers (positive balance)
  const payers: { name: string; amount: number }[] = [];
  const receivers: { name: string; amount: number }[] = [];
  
  sortedParticipants.forEach(person => {
    const balance = balances[person];
    if (balance < -0.01) {
      payers.push({ name: person, amount: -balance });
    } else if (balance > 0.01) {
      receivers.push({ name: person, amount: balance });
    }
  });
  
  // Match payers with receivers
  while (payers.length > 0 && receivers.length > 0) {
    const payer = payers[0];
    const receiver = receivers[0];
    
    const amount = Math.min(payer.amount, receiver.amount);
    
    if (amount > 0) {
      settlements.push({
        from: payer.name,
        to: receiver.name,
        amount: Math.round(amount),
      });
    }
    
    payer.amount -= amount;
    receiver.amount -= amount;
    
    if (payer.amount < 0.01) payers.shift();
    if (receiver.amount < 0.01) receivers.shift();
  }
  
  return settlements;
}
