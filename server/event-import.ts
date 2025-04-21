import { DatabaseStorage } from './storage';
import { db } from './db';
import { events, dateOptions, attendances, attendanceResponses, expenses } from '@shared/schema';
import { eq } from 'drizzle-orm';

// 移行するイベントの手動データ
const eventsToImport = [
  // スターウォーズのイベント
  {
    id: "hkPxosuTMrh0S7W5hJLYB",
    title: "スターウォーズ鑑賞会",
    description: "旧三部作を一気見しましょう！",
    creatorName: "やまぴ",
    selectedDate: "2023-05-20",
    startTime: "13:00",
    endTime: "21:00",
    defaultStartTime: "13:00", 
    defaultEndTime: "21:00",
    participantsCount: 3,
    memo: "エピソード4から6まで見る予定です。\nポップコーンは私が用意します！",
    dateOptions: [
      {
        id: "do_123",
        eventId: "hkPxosuTMrh0S7W5hJLYB",
        date: "2023-05-20",
        startTime: "13:00",
        endTime: "21:00"
      },
      {
        id: "do_124",
        eventId: "hkPxosuTMrh0S7W5hJLYB",
        date: "2023-05-27",
        startTime: "13:00",
        endTime: "21:00"
      }
    ],
    attendances: [
      {
        id: "att_123",
        eventId: "hkPxosuTMrh0S7W5hJLYB",
        name: "やまぴ",
        responses: [
          {
            dateOptionId: "do_123",
            status: "available"
          },
          {
            dateOptionId: "do_124",
            status: "unavailable"
          }
        ]
      },
      {
        id: "att_124",
        eventId: "hkPxosuTMrh0S7W5hJLYB",
        name: "たなか",
        responses: [
          {
            dateOptionId: "do_123",
            status: "available"
          },
          {
            dateOptionId: "do_124",
            status: "maybe"
          }
        ]
      },
      {
        id: "att_125",
        eventId: "hkPxosuTMrh0S7W5hJLYB",
        name: "すずき",
        responses: [
          {
            dateOptionId: "do_123",
            status: "available"
          },
          {
            dateOptionId: "do_124",
            status: "available"
          }
        ]
      }
    ],
    expenses: [
      {
        id: "exp_123",
        eventId: "hkPxosuTMrh0S7W5hJLYB",
        payerName: "やまぴ",
        description: "ポップコーン＆ドリンク",
        amount: "3600",
        participants: ["やまぴ", "たなか", "すずき"],
        isSharedWithAll: true
      },
      {
        id: "exp_124",
        eventId: "hkPxosuTMrh0S7W5hJLYB",
        payerName: "たなか",
        description: "ピザ",
        amount: "4500",
        participants: ["やまぴ", "たなか", "すずき"],
        isSharedWithAll: true
      }
    ]
  },
  // 川サウナのイベント
  {
    id: "j1hUntTx5df4_4LCYfa2p",
    title: "多摩川サウナ巡り",
    description: "多摩川沿いのサウナスポットを巡ります",
    creatorName: "さとう",
    selectedDate: "2023-06-10",
    startTime: "10:00",
    endTime: "18:00",
    defaultStartTime: "10:00", 
    defaultEndTime: "18:00",
    participantsCount: 4,
    memo: "集合場所：二子玉川駅改札前\n持ち物：タオル、水着、サンダル\n予算：約5000円",
    dateOptions: [
      {
        id: "do_223",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        date: "2023-06-10",
        startTime: "10:00",
        endTime: "18:00"
      },
      {
        id: "do_224",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        date: "2023-06-17",
        startTime: "10:00",
        endTime: "18:00"
      }
    ],
    attendances: [
      {
        id: "att_223",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        name: "さとう",
        responses: [
          {
            dateOptionId: "do_223",
            status: "available"
          },
          {
            dateOptionId: "do_224",
            status: "available"
          }
        ]
      },
      {
        id: "att_224",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        name: "やまだ",
        responses: [
          {
            dateOptionId: "do_223",
            status: "available"
          },
          {
            dateOptionId: "do_224",
            status: "unavailable"
          }
        ]
      },
      {
        id: "att_225",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        name: "わたなべ",
        responses: [
          {
            dateOptionId: "do_223",
            status: "available"
          },
          {
            dateOptionId: "do_224",
            status: "maybe"
          }
        ]
      },
      {
        id: "att_226",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        name: "いとう",
        responses: [
          {
            dateOptionId: "do_223",
            status: "maybe"
          },
          {
            dateOptionId: "do_224",
            status: "available"
          }
        ]
      }
    ],
    expenses: [
      {
        id: "exp_223",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        payerName: "さとう",
        description: "サウナ施設入場料（4人分）",
        amount: "9600",
        participants: ["さとう", "やまだ", "わたなべ", "いとう"],
        isSharedWithAll: true
      },
      {
        id: "exp_224",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        payerName: "わたなべ",
        description: "昼食（カフェでの食事）",
        amount: "6800",
        participants: ["さとう", "やまだ", "わたなべ", "いとう"],
        isSharedWithAll: true
      },
      {
        id: "exp_225",
        eventId: "j1hUntTx5df4_4LCYfa2p",
        payerName: "いとう",
        description: "飲み物（サウナ後）",
        amount: "2400",
        participants: ["さとう", "やまだ", "わたなべ", "いとう"],
        isSharedWithAll: true
      }
    ]
  }
];

// マニュアルインポート関数
async function importEvents() {
  try {
    console.log("🔄 特定イベントのインポートを開始します...");
    
    // データベースストレージインスタンスを作成
    const dbStorage = new DatabaseStorage();
    
    // 各イベントをインポート
    for (const eventData of eventsToImport) {
      console.log(`イベントID ${eventData.id} のインポート処理を開始...`);
      
      // 既にデータベースに存在するか確認
      try {
        const [existingEvent] = await db.select().from(events).where(eq(events.id, eventData.id));
        if (existingEvent) {
          console.log(`⚠️ イベントID ${eventData.id} は既にデータベースに存在します。スキップします。`);
          continue;
        }
      } catch (error) {
        // テーブルが存在しない場合などのエラーは無視して続行
      }
      
      console.log(`イベント「${eventData.title}」のインポートを開始...`);
      
      // 1. イベントの登録
      const newEvent = await dbStorage.createEvent({
        id: eventData.id,
        title: eventData.title,
        description: eventData.description || null,
        creatorName: eventData.creatorName,
        selectedDate: eventData.selectedDate || null,
        startTime: eventData.startTime || null,
        endTime: eventData.endTime || null,
        defaultStartTime: eventData.defaultStartTime || null,
        defaultEndTime: eventData.defaultEndTime || null,
        participantsCount: eventData.participantsCount || 0,
        participants: [],
        memo: eventData.memo || null,
        memoLastEditedBy: null,
        memoLastEditedAt: null,
      });
      
      // 2. イベント日程選択肢のインポート
      console.log(`イベント「${eventData.title}」の日程選択肢（${eventData.dateOptions.length}件）をインポート中...`);
      for (const dateOption of eventData.dateOptions) {
        await dbStorage.createDateOption({
          id: dateOption.id,
          eventId: eventData.id,
          date: dateOption.date,
          startTime: dateOption.startTime,
          endTime: dateOption.endTime
        });
      }
      
      // 3. 出欠回答のインポート
      console.log(`イベント「${eventData.title}」の出欠回答（${eventData.attendances.length}件）をインポート中...`);
      
      for (const attendance of eventData.attendances) {
        const newAttendance = await dbStorage.createAttendance({
          id: attendance.id,
          eventId: eventData.id,
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
      
      // 4. 支出データのインポート
      console.log(`イベント「${eventData.title}」の支出データ（${eventData.expenses.length}件）をインポート中...`);
      
      for (const expense of eventData.expenses) {
        await dbStorage.createExpense({
          id: expense.id,
          eventId: eventData.id,
          payerName: expense.payerName,
          description: expense.description,
          amount: expense.amount,
          participants: expense.participants || [],
          isSharedWithAll: expense.isSharedWithAll
        });
      }
      
      console.log(`✅ イベント「${eventData.title}」のインポートが完了しました。`);
    }
    
    console.log("✅ 特定イベントのインポートが完了しました。");
  } catch (error) {
    console.error("❌ 特定イベントのインポート中にエラーが発生しました:", error);
  }
}

// インポート関数を実行
importEvents()
  .catch(error => console.error("インポートエラー:", error));