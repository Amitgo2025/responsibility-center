# Responsibility Center

אפליקציית React + Firebase לניהול אחריות בצוות.

**גרסה 1.4 — חדש:**
- **Morning Plan** — בטאב האישי של כל אחד, אזור בולט שבו ממלאים כל בוקר את התכנון: שורות עם בחירת לאן (SUB NICHES, DAILY FAST, וכו') + פלטפורמות + הערות חופשיות. אחרי שליחה, למחרת בבוקר חייבים לסגור את האתמול עם פידבק טקסטואלי לפני שאפשר לתכנן יום חדש. כולם רואים את התכנונים של כולם.
- **Daily Update** — אזור באנר שאדמין יכול לכתוב הודעת יום שתופיע לכל אחד בטאב שלו וגם ב-All Responsibilities. נעלם אוטומטית בסוף היום.
- **Chat** — צ'אט קבוצתי משותף לכל הצוות. badge בסיידבר עם מספר ההודעות שטרם נקראו.

**גרסה 1.3:**
- **Deadlines למשימות מתוזמנות** — לכל משימה אפשר להגדיר שעת יעד (HH:MM שעון ישראל). אם המשימה לא נסגרה עד אז — מסומנת **Missed** באוטומטית.
- **History page** — דף עם כל הביצועים של כל המשימות, סינון לפי תאריך, אדם, משימה, סטטוס. סטטיסטיקות אחוז הצלחה.
- **Reassign** — אדמין יכול לשנות שיוך של משימה גם להיום וגם רטרואקטיבית.
- מכשיר נרשם בלוג בכל סגירה (Desktop / Mobile / Tablet).

**גרסה 1.2:**
- **Schedule** — לוח זמנים יומי עם cadence (יומית / שבועית / תאריכים ספציפיים / Custom).
- **Image lightbox** לסקרינשוטים בהערות.

**גרסה 1.1:**
- שתי תצוגות לכל אדם — Media Buying Tasks ו-Other Responsibilities.
- All Responsibilities עם חיפוש ופילטרים.
- Notes & Requests עם תגיות ו-Ctrl+V לסקרינשוטים.
- תגיות גמישות.

## מחסניות הנתונים (Firestore collections)

- `config/auth` — סיסמאות (hashes)
- `tabs/{personId}` — אנשים
- `responsibilities/{id}` — כל האחריות, עם `personId`, `section`, `tags[]`
- `tagCategories/{id}` — קטגוריות תגיות
- `tags/{id}` — תגיות (כל תגית עם `categoryId`)
- `notes/{id}` — הערות/בקשות
- `scheduleTasks/{id}` — תבניות משימות מתוזמנות עם `cadence` ו-`assignments`
- `taskInstances/{id}` — משימות יום ספציפיות, עם `status` ו-log סגירה

## הפעלה ראשונה (אם זה Firebase project חדש)

1. ב-Firebase Console: צור פרויקט חדש (כבר יש לך — `responsibility-center`).
2. הפעל Firestore Database (Native mode, region קרוב).
3. ב-Rules ב-Firestore — הדבק את התוכן של `firestore.rules` ופרסם.
4. ב-Project Settings → General → Your apps → Add Web app — קח את ה-config.

## הרצה לוקאלית

```bash
cp .env.example .env
# מלא את 6 ערכי VITE_FIREBASE_* מה-config של Firebase
npm install
npm run dev
```

## דיפלוי ל-Netlify

1. דחוף לגיטהאב (`git init`, `git add .`, `git commit`, `git push`).
2. ב-Netlify: New site → Import from GitHub → בחר את ה-repo.
3. הגדרות הבילד ימולאו אוטומטית מ-`netlify.toml`.
4. ב-**Site configuration → Environment variables** הוסף את 6 משתני `VITE_FIREBASE_*`.
5. Trigger deploy.
6. כשהאתר עולה לאוויר — היכנס ל-`/setup` כדי להגדיר סיסמאות (viewer + admin) ולטעון את הנתונים הראשוניים.

## שימוש

**הצוות (viewer):**
- מתחבר עם השם שלו + סיסמת viewer.
- רואה את כולם, יכול לפתוח הערות ולצרף סקרינשוטים.
- רואה את כל ההערות (שקיפות מלאה).

**אדמין (Amit):**
- אותה כניסה אבל עם סיסמת admin.
- מוסיף/עורך/מוחק אחריות, מנהל אנשים, מנהל קטגוריות ותגיות.
- מסמן הערות כסגורות.
- כפתור Admin settings בסיידבר פותח את כל הניהול.

## איך להוסיף קטגוריית תגיות חדשה

Admin settings → Tags & Categories → רושם שם הקטגוריה ולחיצה על "+ Category". תוך כל קטגוריה אפשר להוסיף תגיות עם צבעים. שינויים נכנסים לכל המקום בו משתמשים בתגית.

## הערות אבטחה

המודל הוא "shared password + URL secrecy". זה מתאים לצוות פנימי קטן. כדי להחמיר, ההמלצה היא להפעיל Firebase Authentication ולעדכן את `firestore.rules` ל-`if request.auth != null` (הוראות בתוך הקובץ).
