# Responsibility Center

אתר פנימי לניהול חלוקת אחריות בצוות. עובד ב-Netlify + Firebase (Firestore), בדיוק כמו אתר חוקי האופטימיזציה.

## מודל הגישה

- **סיסמה אחת לצפייה** — כל אחד בצוות יכול להיכנס עם הסיסמה הזו ולראות הכל (קריאה בלבד)
- **סיסמה אחת לאדמין** — רק לך. מאפשרת עריכת אחריויות, הוספה/מחיקה של טאבים, ושינוי סיסמאות
- אין user/password לכל משתמש — פשוט הקלדת סיסמה אחת ונכנסים. הסיסמה מוגדרת במסך setup הראשוני, וניתנת לשינוי בכל עת מתוך פאנל האדמין

## מה כולל

- 7 טאבים מוכנים מהמסמכים: **Amit · Dina · Elran · Or · Elad · Yoav · Cross-Cutting**
- כל הפרטים מהמצגות הוטענו אוטומטית — שמות לאנס (SUB NICHES, DAILY RESEARCH, וכו'), שותפים, וההיגיון של החלוקה
- הטאב של עצמך (Amit) כולל את 16 הפעולות התפעוליות ששלחת — דוחות, סורסים, באלקים, אופט, מענה לקניינים, פגישות בוקר, וכו'
- טאב "Cross-Cutting" שמציג את כל המשימות עם הבעלים שלהן (טבלה מסכמת)
- כל פריט יכול להיות בסטטוס Active / Under Review / Transitioning
- עריכה מלאה לאדמין: שינוי טקסט, סטטוס, סדר (חצים למעלה/למטה), הוספה/מחיקה של פריטים

## הקמה — שלב אחר שלב

### 1. Firebase

אם יש לך כבר את הפרויקט `optimization-center-474ad` — אפשר להשתמש באותו פרויקט (החיסכון: לא צריך להגדיר מחדש). פשוט ניצור collection חדש (`tabs` ו-`config`) שלא יתערבב עם החוקים הקיימים.

או, אם אתה רוצה פרויקט חדש לחלוטין:

1. Firebase Console → Add project → תן שם (למשל `responsibility-center`)
2. כבה את Google Analytics
3. Build → Firestore Database → Create database → Production mode → location: `eur3 (europe-west)`
4. בטאב Rules של Firestore — הדבק את התוכן של `firestore.rules` שצירפתי, ולחץ Publish
5. **אין צורך להפעיל Authentication** — האתר הזה לא משתמש בו (סיסמה אחת משותפת)
6. Project Settings (גלגל שיניים) → General → Your apps → אייקון `</>` → Register app → תקבל את ה-config

### 2. הגדרה מקומית (אופציונלי, לבדיקה לפני העלאה)

```bash
cd responsibility-app
cp .env.example .env.local
# ערוך את .env.local והדבק את ערכי ה-Firebase
npm install
npm run dev
```

פתח http://localhost:5173 — תועבר אוטומטית למסך setup, שם תיצור את שתי הסיסמאות וגם תוכל לטעון את כל הנתונים מהמצגות בלחיצה אחת.

### 3. העלאה ל-Netlify

הדרך המומלצת: GitHub + Netlify (אותו תהליך כמו האתר השני שלך)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Amitgo2025/responsibility-center.git
git push -u origin main
```

(כמובן צריך ליצור קודם את הריפו ב-GitHub)

ואז ב-Netlify:
1. Add new site → Import an existing project → GitHub
2. בחר את הריפו החדש
3. Build settings יזוהו אוטומטית מ-`netlify.toml`
4. הוסף את ששת משתני הסביבה (אותם 6 ערכים מ-Firebase)
5. Deploy

### 4. הוספת הדומיין ל-Firebase

(רק אם אתה משתמש ב-Authentication — באתר הזה זה **לא נחוץ**, אבל אם תרצה להחמיר לעתיד, זה צעד טוב להכיר)

### 5. Setup ראשוני

לאחר Deploy, גש ל-`https://YOUR-SITE.netlify.app/setup`. שם תגדיר:
- סיסמה לצפייה (פשוטה, להעביר לצוות)
- סיסמה לאדמין (חזקה יותר, רק לך)
- האם לטעון את כל הנתונים מהמצגות בלחיצה אחת (מומלץ)

אחרי setup, מסך זה כבר לא יהיה זמין — תפנה ישירות ל-`/login`.

### 6. שיתוף עם הצוות

תן להם פשוט:
- את כתובת האתר
- את הסיסמה לצפייה

הם יכולים להיכנס מכל מקום, בלי חשבונות, בלי הרשמות.

## ניהול לאחר ההפעלה

מתוך פאנל האדמין (כפתור "Admin settings" בתחתית הסיידבר):

- **Passwords** — שינוי סיסמת צפייה ו/או סיסמת אדמין. נדרשת אימות עם הסיסמה הנוכחית של האדמין
- **Manage tabs** — יצירת טאבים חדשים (למשל אם תוסיף איש צוות) ומחיקת טאבים קיימים. עריכת תוכן הטאב נעשית מתוך הטאב עצמו (כפתור "Edit" בכותרת)

## שינויים בהמשך — Workflow

```bash
# שינוי קוד מקומי
git add .
git commit -m "תיאור השינוי"
git push
```

Netlify יבנה ויפרוס אוטומטית.

## הערות אבטחה

המודל הזה מתאים לכלי פנימי שמאחורי URL לא-פומבי + סיסמה משותפת. מי שמקבל את הסיסמה ואת הכתובת — נכנס. הסיסמאות עצמן נשמרות ב-Firestore כ-SHA-256 hashes, כך שגם מי שיש לו גישת קריאה ל-DB לא רואה את הסיסמאות בטקסט גלוי.

לחיזוק נוסף, אפשר:
- להוסיף הגנת סיסמה ברמת Netlify (Site settings → Visitor access → Password protection — בחבילה בתשלום)
- להגביל את Firebase API key לפי HTTP referrer (Google Cloud Console → APIs & Credentials)
- להוסיף בעתיד Firebase Auth מלא עם משתמשים נפרדים

## מבנה הפרויקט

```
responsibility-app/
├── src/
│   ├── App.jsx              # Router + protected shell
│   ├── main.jsx             # React entry
│   ├── index.css            # Global styles + Tailwind
│   ├── lib/
│   │   ├── firebase.js      # Firebase init
│   │   ├── auth.js          # Shared-password auth
│   │   └── db.js            # Firestore CRUD for tabs
│   ├── data/
│   │   └── seed.js          # Pre-loaded team data from PDFs
│   ├── pages/
│   │   ├── LoginPage.jsx    # Single-password entry
│   │   └── SetupPage.jsx    # First-run bootstrap
│   └── components/
│       ├── Sidebar.jsx      # Tab navigation
│       ├── TabView.jsx      # Main responsibility list + edit
│       └── AdminPanel.jsx   # Settings modal
├── public/
│   └── favicon.svg
├── firestore.rules          # Firestore security rules
├── netlify.toml             # Netlify config + SPA redirect
├── tailwind.config.js
├── vite.config.js
├── postcss.config.js
├── package.json
└── .env.example
```

תהנו 🎯
