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
      
      // 参加者を登録（もし指定されていれば）
      let participantCount = 0;
      if (req.body.participants && Array.isArray(req.body.participants)) {
        await Promise.all(
          req.body.participants.map(async (name: string) => {
            const attendanceId = nanoid();
            await storage.createAttendance({
              id: attendanceId,
              eventId,
              name,
            });
            participantCount++;
          })
        );
        
        // 参加者数を更新
        if (participantCount > 0) {
          await storage.updateEvent(eventId, {
            participantsCount: participantCount,
          });
        }
      }
      
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
      
      // 既存の出席者リストを取得
      const existingAttendances = await storage.getEventAttendances(req.params.id);
      const existingAttendance = existingAttendances.find(a => a.name === validatedData.name);
      
      let attendance;
      
      if (existingAttendance) {
        // 既存の回答を更新
        await storage.updateAttendanceResponses(existingAttendance.id, validatedData.responses);
        attendance = existingAttendance;
      } else {
        // 新しい出席情報を作成
        const attendanceId = nanoid();
        attendance = await storage.createAttendance({
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
      }
      
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
        participants: z.array(z.string()).default([]), // 割り勘対象者の配列（指定がない場合は空配列）
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
        participants: validatedData.participants,
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
  
  // 1. 全ての参加者を集める
  const participants = new Set<string>();
  
  expenses.forEach(expense => {
    // 支払者を追加
    participants.add(expense.payerName);
    
    // 参加者リストを追加
    if (expense.participants && expense.participants.length > 0) {
      expense.participants.forEach((p: string) => participants.add(p));
    } else {
      // 参加者が指定されていない場合、その時点で登録されている全員を追加
      // 注: この場合はループが完了するまで全員を確定できないが、支払者だけは確実に含まれる
    }
  });
  
  // 参加者の名前を配列に変換
  const participantList = Array.from(participants);
  
  // 2. 各参加者の支払い金額と負担金額を計算
  const balanceData: { [key: string]: { paid: number, shouldPay: number } } = {};
  
  // 初期化
  participantList.forEach(name => {
    balanceData[name] = { paid: 0, shouldPay: 0 };
  });
  
  // 各支出に対して精算計算
  expenses.forEach(expense => {
    const amount = Math.round(Number(expense.amount)); // 円単位なので整数に
    const payerName = expense.payerName;
    
    // 支払者の支払額を加算
    balanceData[payerName].paid += amount;
    
    // 分割対象者を決定
    let splitTargets: string[];
    
    if (expense.participants && expense.participants.length > 0) {
      // 特定の参加者間で分割
      splitTargets = expense.participants;
    } else {
      // 全員で分割
      splitTargets = participantList;
    }
    
    // 一人あたりの金額計算（小数点以下切り捨て）
    const perPersonBase = Math.floor(amount / splitTargets.length);
    // 余りの計算
    const remainder = amount - (perPersonBase * splitTargets.length);
    
    // 各参加者の負担額を加算
    splitTargets.forEach((person, index) => {
      // 基本金額を負担額に加算
      balanceData[person].shouldPay += perPersonBase;
      
      // 端数処理: 先頭から remainder 人に 1円ずつ追加
      if (index < remainder) {
        balanceData[person].shouldPay += 1;
      }
    });
  });
  
  // 3. 最終的な貸し借り計算
  const settlements: { from: string; to: string; amount: number }[] = [];
  
  // 各参加者の貸し借り状況を計算
  const balances: { name: string, balance: number }[] = [];
  
  Object.entries(balanceData).forEach(([name, data]) => {
    const balance = data.paid - data.shouldPay; // プラスなら貸し、マイナスなら借り
    balances.push({ name, balance });
    
    // デバッグ用
    // console.log(`${name}: 支払額=${data.paid}円, 負担額=${data.shouldPay}円, 差額=${balance}円`);
  });
  
  // 支払う人と受け取る人に分ける
  const debtors = balances.filter(p => p.balance < 0).map(p => ({ name: p.name, amount: -p.balance }));
  const creditors = balances.filter(p => p.balance > 0).map(p => ({ name: p.name, amount: p.balance }));
  
  // 貸し借りの組み合わせを作成
  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0]; // 借りている人（支払う人）
    const creditor = creditors[0]; // 貸している人（受け取る人）
    
    // どちらか少ない方の金額で精算
    const settleAmount = Math.min(debtor.amount, creditor.amount);
    
    if (settleAmount > 0) {
      // 精算: 借りている人 → 貸している人
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: Math.round(settleAmount), // 整数にする
      });
    }
    
    // 金額を更新
    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;
    
    // 0になった人を配列から削除
    if (debtor.amount < 0.01) debtors.shift();
    if (creditor.amount < 0.01) creditors.shift();
  }
  
  return settlements;
}
