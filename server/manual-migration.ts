import { MemStorage, DatabaseStorage } from './storage';
import { db } from './db';
import { events, dateOptions, attendances, attendanceResponses, expenses } from '@shared/schema';
import { eq } from 'drizzle-orm';

// 移行するイベントIDを指定（スターウォーズと川サウナのイベントID）
const eventIdsToMigrate = [
  'hkPxosuTMrh0S7W5hJLYB', // スターウォーズ
  'j1hUntTx5df4_4LCYfa2p'  // 川サウナ
];

// マニュアル移行関数
async function manualMigrate() {
  try {
    console.log("🔄 特定イベントの手動移行を開始します...");
    
    // 1. 一時的にストレージインスタンスを作成
    const memStorage = new MemStorage();
    const dbStorage = new DatabaseStorage();
    
    // 2. 指定されたイベントだけを取得して移行
    for (const eventId of eventIdsToMigrate) {
      console.log(`イベントID ${eventId} の移行処理を開始...`);
      
      const event = await memStorage.getEvent(eventId);
      if (!event) {
        console.log(`⚠️ イベントID ${eventId} はメモリストレージに存在しません。スキップします。`);
        continue;
      }
      
      // 既にデータベースに存在するか確認
      try {
        const [existingEvent] = await db.select().from(events).where(eq(events.id, eventId));
        if (existingEvent) {
          console.log(`⚠️ イベントID ${eventId} は既にデータベースに存在します。スキップします。`);
          continue;
        }
      } catch (error) {
        // テーブルが存在しない場合などのエラーは無視して続行
      }
      
      console.log(`イベント「${event.title}」の移行を開始...`);
      
      // 3. イベントの登録
      const newEvent = await dbStorage.createEvent({
        id: event.id,
        title: event.title,
        description: event.description || null,
        creatorName: event.creatorName,
        selectedDate: event.selectedDate || null,
        startTime: event.startTime || null,
        endTime: event.endTime || null,
        defaultStartTime: event.defaultStartTime || null,
        defaultEndTime: event.defaultEndTime || null,
        participantsCount: event.participantsCount || 0,
        participants: event.participants || [],
        memo: event.memo || null,
        memoLastEditedBy: event.memoLastEditedBy || null,
        memoLastEditedAt: event.memoLastEditedAt || null,
      });
      
      // 4. メモ編集ロックの移行（あれば）
      if (event.memoEditLock) {
        await db
          .update(events)
          .set({ memoEditLock: event.memoEditLock })
          .where(eq(events.id, event.id));
      }
      
      // 5. イベント日程選択肢の移行
      console.log(`イベント「${event.title}」の日程選択肢（${event.dateOptions.length}件）を移行中...`);
      for (const dateOption of event.dateOptions) {
        await dbStorage.createDateOption({
          id: dateOption.id,
          eventId: event.id,
          date: dateOption.date,
          startTime: dateOption.startTime,
          endTime: dateOption.endTime
        });
      }
      
      // 6. 出欠回答の移行
      const attendancesList = await memStorage.getEventAttendances(event.id);
      console.log(`イベント「${event.title}」の出欠回答（${attendancesList.length}件）を移行中...`);
      
      for (const attendance of attendancesList) {
        const newAttendance = await dbStorage.createAttendance({
          id: attendance.id,
          eventId: event.id,
          name: attendance.name
        });
        
        if (attendance.responses && attendance.responses.length > 0) {
          await dbStorage.updateAttendanceResponses(
            attendance.id,
            attendance.responses.map(response => ({
              dateOptionId: response.dateOptionId,
              status: response.status
            }))
          );
        }
      }
      
      // 7. 支出データの移行
      const expensesList = await memStorage.getEventExpenses(event.id);
      console.log(`イベント「${event.title}」の支出データ（${expensesList.length}件）を移行中...`);
      
      for (const expense of expensesList) {
        await dbStorage.createExpense({
          id: expense.id,
          eventId: event.id,
          payerName: expense.payerName,
          description: expense.description,
          amount: expense.amount,
          participants: expense.participants || [],
          isSharedWithAll: expense.isSharedWithAll
        });
      }
      
      console.log(`✅ イベント「${event.title}」の移行が完了しました。`);
    }
    
    console.log("✅ 特定イベントの手動移行が完了しました。");
  } catch (error) {
    console.error("❌ 特定イベントの手動移行中にエラーが発生しました:", error);
  }
}

// 移行関数を実行
manualMigrate()
  .catch(error => console.error("移行エラー:", error));