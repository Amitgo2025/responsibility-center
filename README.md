# Responsibility Center

אפליקציית React + Firebase לניהול אחריות בצוות.

**גרסה 1.3 — חדש:**
- **Deadlines למשימות מתוזמנות** — לכל משימה אפשר להגדיר שעת יעד (HH:MM שעון ישראל). אם המשימה לא נסגרה עד אז — מסומנת **Missed** באוטומטית, באנר אדום.
- **History page** — דף חדש (Sidebar → History) עם **כל הביצועים** של כל המשימות. סינון לפי תאריך, אדם, משימה, סטטוס. סטטיסטיקות אחוז הצלחה. כל הזמנים בשעון ישראל.
- **Reassign** — אדמין יכול לשנות שיוך של משימה ספציפית גם להיום וגם רטרואקטיבית מתוך ההיסטוריה.

**גרסה 1.2:**
- **Schedule** — לוח זמנים יומי. אדמין מגדיר משימות חוזרות (יומית / שבועית / תאריכים ספציפיים / Custom) ומשבץ אדם אחר בכל יום דרך לוח שנה. משימות היום קופצות בראש "All Responsibilities" וגם בטאב האישי של כל אחד, ונשארות פתוחות עד שמישהו סוגר. כל סגירה נרשמת — שם המשימה, מי סגר, מתי.
- **Image lightbox** — לחיצה על סקרינשוט פותחת אותו בגדול עם חצים בין תמונות. בלי tab חדש, בלי קרופ.

**גרסה 1.1:**

- שתי תצוגות לכל אדם — **Media Buying Tasks** (משימות שוטפות לפי הלאנים) ו-**Other Responsibilities** (אחריות אופרטיבית לרוחב, כמו דוחות, חשבונות, compliance)
- **All Responsibilities** — דף חיפוש אחד עם כל האחריות בצוות, עם פילטרים לפי אדם, סקשן, סטטוס, ותגיות
- **Notes & Requests** — כל אחד יכול לפתוח הערה/בקשה על אחריות. כולל תגיות, צירוף סקרינשוטים (Ctrl+V), וסטטוס Open/Closed. אדמין מסמן סגור.
- **תגיות גמישות** — האדמין מנהל קטגוריות (Platform, Type, Frequency וכל מה שתרצה) ותגיות בתוכן. כל אחריות יכולה לקבל כמה שצריך.
- אין יותר אחוזים.

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
