require('dotenv').config({ path: '../.env' })

const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')
const cron = require('node-cron')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

async function sendReminderEmail(email, previewId) {
    console.log(`[Reminder] Démarrage préparation email pour ${email} (preview ${previewId})`)
    const randomHours = Math.floor(Math.random() * 12) + 1;
    const futureDateTime = new Date(Date.now() + randomHours * 60 * 60 * 1000).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(/:/g, 'h').replace(/\s+/g, ' ').trim()
    console.log(`[Reminder] Date future formatée : ${futureDateTime}`)
    const url = `https://www.tunemyday.fr/music/preview/${previewId}`
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rappel : votre extrait vous attend</title></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background-color:#f0f4f8">
    <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 4px 10px rgba(0,0,0,0.1)">
        <div style="text-align:center;margin-bottom:30px">
            <h1 style="color:#1E1E3F;font-size:28px;margin-bottom:10px">Votre extrait personnalisé vous attend !</h1>
            <p style="color:#555;font-size:16px;line-height:1.5">On a concocté cette musique juste pour vous ❤️</p>
        </div>
        <div style="background:linear-gradient(135deg, #F5564E 0%, #FEC260 100%); padding:40px 30px; border-radius:20px; text-align:center; margin-bottom:40px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
            <h2 style="color:white; font-size:32px; margin-bottom:15px; font-weight:800; letter-spacing:1px;">
            🎁 Votre code exclusif
            </h2>
            <p style="color:white; font-size:18px; line-height:1.6; margin-bottom:30px; max-width:450px; margin-left:auto; margin-right:auto;">
                Profitez de <strong style="font-size:22px;">-20 %</strong> sur votre chanson complète jusqu'au <strong>${futureDateTime}</strong> avec le code <strong style="background:white; color:#F5564E; padding:4px 10px; border-radius:6px;">MELODY20</strong> !
            </p>
            <a href="${url}" style="display:inline-block; background:white; color:#F5564E; text-decoration:none; padding:20px 45px; border-radius:40px; font-weight:800; font-size:20px; box-shadow:0 4px 10px rgba(0,0,0,0.2); transition:all 0.3s ease;">
            🎶 Écouter mon extrait
            </a>
        </div>
        <div style="text-align: center; color: #666; font-size: 14px;">
        <p>Un extrait de 15 secondes vous attend. Si vous l’aimez, débloquez la version complète.</p>
        <p style="margin-top: 20px;">À très vite sur <a href="https://www.tunemyday.fr" target="_blank" style="color:#F5564E;text-decoration:none">TuneMyDay</a> !</p>
        </div>
    </div>
</body>
</html>`
    console.log(`[Reminder] HTML du mail généré pour preview ${previewId}`)
    await resend.emails.send({
        from: 'TuneMyDay <noreply@tunemyday.fr>',
        to: [email],
        subject: '⏳ Votre extrait vous attend toujours !',
        html
    })
    console.log(`[Reminder] Email envoyé à ${email} pour preview ${previewId}`)
}

// sendReminderEmail("paulyne25200@gmail.com", "ce16b021f2e76b229af66cd9d100e031")