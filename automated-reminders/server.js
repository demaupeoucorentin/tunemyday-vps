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

cron.schedule('0 * * * *', async () => {
    const now = new Date().toISOString()
    console.log(`[Cron] Démarrage à ${now}`)

    // Seuil statique : previews créées après le 27 avril 2025 à 01:00 (Paris)
    const minCreatedAt = new Date('2025-04-27T01:00:00+02:00').toISOString()
    console.log(`[Cron] Filtrer previews créées après ${minCreatedAt}`)

    // Seuil dynamique : au moins 24 h passées depuis created_at
    const maxCreatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    console.log(`[Cron] Filtrer previews créées avant ${maxCreatedAt}`)

    const { data: rows, error } = await supabase
        .from('music_previews')
        .select('email, preview_id, is_first_reminder_sent')
        .or('checkout_success.is.null,checkout_success.eq.false')
        .gt('created_at', minCreatedAt)
        .lt('created_at', maxCreatedAt)

    if (error) {
        console.error('[Cron] Erreur lecture Supabase :', error)
        return
    }

    console.log(`[Cron] Previews trouvées après filtrage : ${rows.length}`)
    const pending = rows.filter(r => !r.is_first_reminder_sent)
    console.log(`[Cron] À relancer : ${pending.length}`)

    const previewIds = [...new Set(pending.map(r => r.preview_id))]
    console.log('[Cron] IDs uniques à traiter :', previewIds)

    for (const previewId of previewIds) {
        const { email } = pending.find(r => r.preview_id === previewId)

        if (email === 'demaupeoucorentin@gmail.com' || email === 'kevin.colinet@gmail.com') {
            console.log(`[Cron] Skip envoi pour ${email}`)
            continue
        }

        try {
            await sendReminderEmail(email, previewId)
            const { error: updateError } = await supabase
                .from('music_previews')
                .update({ is_first_reminder_sent: true })
                .eq('preview_id', previewId)

            if (updateError) {
                console.error(`[Cron] Erreur update is_first_reminder_sent pour ${previewId} :`, updateError)
            } else {
                console.log(`[Cron] is_first_reminder_sent passé à true pour ${previewId}`)
            }
        } catch (err) {
            console.error(`[Cron] Erreur traitement pour ${previewId} :`, err)
        }
    }

    console.log(`[Cron] Fin cycle à ${new Date().toISOString()}`)
})

process.stdin.resume()
