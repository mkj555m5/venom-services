#!/usr/bin/env node
/**
 * Venom Services — Database auto-setup
 * يتكيف تلقائياً مع نوع DATABASE_URL الموجود في البيئة:
 *   postgresql://... → يحوّل الـ schema إلى PostgreSQL
 *   file:... أو لا شيء → SQLite (افتراضي: file:/data/venom.db — ربط Volume على /data في Railway لحفظ البيانات)
 *
 * يُنفّذ في مرحلتي البناء والإقلاع (idempotent — لا يعيد التوليد إلا عند تغيّر الـ provider فعلياً)
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const PROVIDERS = ['sqlite', 'postgresql', 'mysql', 'sqlserver', 'mongodb']

function targetProvider(url) {
  if (!url) return 'sqlite'
  if (/^postgres(ql)?:\/\//i.test(url)) return 'postgresql'
  if (/^mysql:\/\//i.test(url)) return 'mysql'
  if (/^sqlserver:\/\//i.test(url)) return 'sqlserver'
  if (/^mongodb(\+srv)?:\/\//i.test(url)) return 'mongodb'
  return 'sqlite'
}

function run(cmd, env = process.env) {
  try {
    execSync(cmd, { stdio: 'inherit', env })
    return true
  } catch (e) {
    console.warn(`[venom-db] ⚠ command failed (continuing): ${cmd}`)
    return false
  }
}

function writableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch { return false }
}

function main() {
  // 1) حدد الـ provider المطلوب من DATABASE_URL
  const url = process.env.DATABASE_URL || ''
  const want = targetProvider(url)
  let schema = fs.readFileSync(SCHEMA, 'utf8')
  const current = (schema.match(/provider\s*=\s*"([a-z]+)"/) || [])[1]

  // 2) في حال غياب DATABASE_URL تماماً → SQLite مع أول مسار قابل للكتابة
  //    (يُفضَّل /data لأنه نقطة ربط Volume في Railway → حفظ دائم)
  const env = { ...process.env }
  if (!url) {
    let dbFile = 'file:/data/venom.db'
    if (!writableDir('/data')) {
      const local = path.join(__dirname, '..', 'venom_data')
      if (writableDir(local)) {
        dbFile = `file:${local}/venom.db`
        console.log('[venom-db] /data غير متاحة → استخدام مجلد المشروع venom_data/ (اربط Volume على /data في Railway للحفظ الدائم)')
      }
    }
    env.DATABASE_URL = dbFile
    console.log(`[venom-db] DATABASE_URL غير مضبوط → الافتراضي ${dbFile}`)
  }

  // 3) بدّل الـ provider في الـ schema فقط عند الحاجة
  if (current && current !== want && PROVIDERS.includes(current)) {
    schema = schema.replace(/provider\s*=\s*"[a-z]+"/, `provider = "${want}"`)
    fs.writeFileSync(SCHEMA, schema)
    console.log(`[venom-db] provider: ${current} → ${want}`)
    // أعد توليد العميل ليتوافق مع المحرك الجديد
    if (!run('npx prisma generate', env)) process.exit(1)
  } else {
    console.log(`[venom-db] provider = ${current} (مطلوب: ${want}) — بلا تغيير`)
  }

  // 4) ادفع الـ schema إلى قاعدة البيانات
  //    في مرحلة البناء قد تكون الشبكة معزولة → لا تفشل البناء؛ في الإقلاع يجب أن ينجح
  const isBuild = process.env.VENOM_DB_PHASE === 'build'
  if (isBuild) {
    run('npx prisma db push --skip-generate', env)
  } else {
    if (!run('npx prisma db push --skip-generate', env)) {
      console.error('[venom-db] ✗ فشل إعداد قاعدة البيانات عند الإقلاع')
      process.exit(1)
    }
  }
  console.log('[venom-db] ✓ جاهز')
}

main()
