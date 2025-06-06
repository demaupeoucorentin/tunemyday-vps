const express = require('express');
const fetch = require('node-fetch');
const { Headers, Response, Request } = require('node-fetch');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const timeout = require('connect-timeout')
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

if (!global.fetch) {
    global.fetch = fetch;
}
global.Headers = Headers;
global.Response = Response;
global.Request = Request;

const app = express();
app.use(express.json());

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
app.use((req, res, next) => {
    res.set(corsHeaders);
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.post('/generate-checkout', (req, res) => {
    console.log('Requête /generate-checkout reçue');
    console.log('Corps de la requête :', req.body);

    const { previewId, cart_items, email } = req.body;
    if (!cart_items || !email) {
        console.log('Paramètres manquants : cart_items ou email');
        return res.status(400).json({ error: 'previewId, cart_items et email sont requis' });
    }

    res.status(200).json({ message: 'Commande reçue, traitement en cours' });
    console.log('Réponse envoyée au client, traitement asynchrone démarré');

    (async () => {
        let idToUpdate = previewId;

        if (previewId) {
            console.log('Connexion à Supabase');
            const { data: previewData, error: previewError } = await supabase
                .from('music_previews')
                .select('*')
                .eq('preview_id', previewId)
                .single();
            if (previewError) {
                console.log('Échec récupération des infos audio :', previewError);
            } else {
                console.log('previewData récupéré');
            }

            console.log('Initialisation Resend');
            const resend = new Resend(process.env.RESEND_API_KEY);

            console.log('Envoi du mail de confirmation');
            await resend.emails.send({
                from: 'TuneMyDay <noreply@tunemyday.fr>',
                to: [email],
                bcc: ['tunemyday.fr+4b07b4c87e@invite.trustpilot.com'],
                subject: '📥 Confirmation de votre commande',
                html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Confirmation de commande</title></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f6f9fc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1E1E3F; margin-bottom: 10px;">Merci pour votre achat !</h1>
    </div>
    <div style="background: linear-gradient(135deg, #FEC260 0%, #F5564E 100%); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
      <p style="color: #666; font-size: 16px; line-height: 1.5;">Nous préparons votre musique personnalisée.</p>
    </div>
    <div style="text-align: center; color: #666; font-size: 14px;">
      <p style="margin-top: 20px;">À très vite sur <a href="https://www.tunemyday.fr" target="_blank" style="color:#F5564E;text-decoration:none">TuneMyDay</a> !</p>
    </div>
  </div>
</body>
</html>`
            });
            console.log('Mail de confirmation envoyé');

            if (previewData && previewData.audio_url) {
                console.log('Audio déjà disponible, envoi du mail final');
                const fullMusicUrl = `https://www.tunemyday.fr/music/full/${previewId}`;
                await resend.emails.send({
                    from: 'TuneMyDay <noreply@tunemyday.fr>',
                    to: [email],
                    bcc: ['tunemyday.fr+4b07b4c87e@invite.trustpilot.com'],
                    subject: '🎵 Votre chanson complète est prête !',
                    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Votre chanson complète est prête !</title></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f6f9fc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1E1E3F; margin-bottom: 10px;">Votre chanson est prête ! 🎵</h1>
      <p style="color: #666; font-size: 16px; line-height: 1.5;">Nous avons créé une chanson unique, rien que pour vous.</p>
    </div>
    <div style="background: linear-gradient(135deg, #FEC260 0%, #F5564E 100%); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
      <h2 style="color: white; margin-bottom: 15px;">${previewData.title}</h2>
      <a href="${fullMusicUrl}" style="display: inline-block; background-color: white; color: #F5564E; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">Écouter mon extrait gratuit</a>
    </div>
    <div style="text-align: center; color: #666; font-size: 14px;">
      <p style="margin-top: 20px;">À très vite sur <a href="https://www.tunemyday.fr" target="_blank" style="color:#F5564E;text-decoration:none">TuneMyDay</a> !</p>
    </div>
  </div>
</body>
</html>`
                });
                console.log('Mail final envoyé');
            }
        } else {
            console.log('Pas d’audio existant, génération via APIBox');
            const item = Array.isArray(cart_items) ? cart_items[0] : cart_items;
            const title = item.pr.title;
            const event_type = item.pr.event_type;
            const music_style = item.pr.music_style;
            const description = item.pr.description;
            const negative_tags = item.pr.negative_tags;
            const selected_emotions = item.pr.selected_emotions;

            const { data: lyricsData } = await supabase.functions.invoke(
                "generate-lyrics",
                {
                    body: {
                        title,
                        event_type: event_type || null,
                        music_style,
                        description: `${description} Il faut que la chanson reflète les émotions suivantes: ${selected_emotions}` || null,
                        negative_tags: negative_tags || null
                    }
                }
            );
            const lyrics = lyricsData?.lyrics;
            if (!lyrics) {
                console.log('Aucune parole générée, arrêt du traitement');
                return;
            }
            console.log('Paroles générées :', lyrics);

            console.log('Préparation de l’appel à APIBox');
            const apiboxKey = process.env.APIBOX_API_KEY;
            const callbackUrl = `https://www.tunemyday.fr/api/callback/audio`;

            const genRes = await fetch('https://apibox.erweima.ai/api/v1/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiboxKey}`
                },
                body: JSON.stringify({
                    prompt: lyrics,
                    style: music_style,
                    title,
                    customMode: true,
                    instrumental: false,
                    model: 'V4',
                    callBackUrl: callbackUrl
                })
            });
            if (!genRes.ok) {
                console.log('Erreur APIBox init, statut :', genRes.status);
                return;
            }
            const { data: genData } = await genRes.json();
            console.log('APIBox taskId :', genData.taskId);

            let audioResults = null;
            let attempts = 0;
            const maxAttempts = 120;
            while (!audioResults && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 1000));
                const recRes = await fetch(
                    `https://apibox.erweima.ai/api/v1/generate/record-info?taskId=${genData.taskId}`,
                    { method: 'GET', headers: { Authorization: `Bearer ${apiboxKey}` } }
                );
                if (!recRes.ok) {
                    console.log('Erreur record-info, statut :', recRes.status);
                    attempts++;
                    continue;
                }
                const { data: recData } = await recRes.json();
                if (recData.status === 'PENDING') {
                    console.log('Statut PENDING, attente avant nouvelle tentative (tentative nº', attempts + 1, ')');
                    attempts++;
                    continue;
                }
                if (recData.status === 'SUCCESS' && recData.response?.sunoData) {
                    audioResults = recData.response.sunoData;
                    console.log('Audio généré avec succès');
                    break;
                }
                if (recData.status === 'ERROR') {
                    console.log('Erreur dans recData pour taskId :', genData.taskId);
                    break;
                }
            }

            if (!audioResults) {
                console.log('Aucun résultat audio après', maxAttempts, 'tentatives');
                return;
            }

            const generatedPreviewId = uuidv4();
            idToUpdate = generatedPreviewId;

            console.log('Insertion des pistes générées en base');
            const records = audioResults.map(item => ({
                id: uuidv4(),
                email,
                preview_id: generatedPreviewId,
                task_id: genData.taskId,
                parent_music_id: genData.parentMusicId,
                param: genData.param,
                response: genData.response,
                status: genData.status,
                type: genData.type,
                operation_type: genData.operationType,
                error_code: genData.errorCode || 0,
                error_message: genData.errorMessage || "",
                audio_url: item.audioUrl,
                stream_audio_url: item.streamAudioUrl,
                image_url: item.imageUrl,
                prompt: item.prompt,
                model_name: item.modelName,
                title: item.title,
                tags: item.tags,
                duration: Math.round(item.duration),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));
            await supabase.from('music_previews').insert(records);
            console.log('Données insérées');

            console.log('Envoi du mail de la musique complète');
            const fullMusicUrl = `https://www.tunemyday.fr/music/full/${generatedPreviewId}`;
            await resend.emails.send({
                from: 'TuneMyDay <noreply@tunemyday.fr>',
                to: [email],
                bcc: ['tunemyday.fr+4b07b4c87e@invite.trustpilot.com'],
                subject: '🎵 Votre chanson complète est prête !',
                html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Votre chanson complète est prête !</title></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f6f9fc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1E1E3F; margin-bottom: 10px;">Votre chanson est prête ! 🎵</h1>
      <p style="color: #666; font-size: 16px; line-height: 1.5;">Nous avons créé une chanson unique, rien que pour vous.</p>
    </div>
    <div style="background: linear-gradient(135deg, #FEC260 0%, #F5564E 100%); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
      <h2 style="color: white; margin-bottom: 15px;">${title}</h2>
      <a href="${fullMusicUrl}" style="display: inline-block; background-color: white; color: #F5564E; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">Écouter mon extrait gratuit</a>
    </div>
    <div style="text-align: center; color: #666; font-size: 14px;">
      <p style="margin-top: 20px;">À très vite sur <a href="https://www.tunemyday.fr" target="_blank" style="color:#F5564E;text-decoration:none">TuneMyDay</a> !</p>
    </div>
  </div>
</body>
</html>`
            });
            console.log('Mail final envoyé, traitement terminé');
        }

        if (idToUpdate) {
            const { error: updateError } = await supabase
                .from('music_previews')
                .update({ checkout_success: true })
                .eq('preview_id', idToUpdate);
            if (updateError) {
                console.log('Erreur mise à jour champ "checkout_success" pour tous les records :', updateError);
            } else {
                console.log(`Champ "checkout_success" mis à jour à true pour tous les enregistrements avec preview_id ${idToUpdate}`);
            }
        }
    })();
});

app.post('/generate-music', (req, res) => {
    req.setTimeout(0);
    res.setTimeout(0);
    console.log('Requête /generate-music reçue');
    console.log('Corps de la requête :', req.body);

    // res.status(200).json({ message: 'Génération de la musique démarrée' });
    // console.log('Réponse envoyée au client, poursuite de l’appel à APIBox');

    (async () => {
        const { email, prompt, style, title, previewId } = req.body;
        console.log('Paramètres reçus :', { email, prompt, style, title, previewId });
        if (!email || !prompt || !style || !title || !previewId) {
            console.log('Paramètres manquants : email, prompt, style, title ou previewId');
            return res.status(400).json({ error: 'email, prompt, style, title et previewId sont requis' });
        }

        try {
            const apiboxKey = process.env.APIBOX_API_KEY;
            const callbackUrl = "https://ippldffmjivhdwfgdubv.supabase.co/functions/v1/audio-callback";
            const payload = { prompt, style, title, customMode: true, instrumental: false, model: 'V4', callBackUrl: callbackUrl };
            console.log('Appel APIBox avec payload :', payload);

            const genRes = await fetch('https://apibox.erweima.ai/api/v1/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiboxKey}`
                },
                body: JSON.stringify(payload)
            });
            console.log('Statut réponse APIBox :', genRes.status);
            if (!genRes.ok) {
                console.log('Erreur APIBox, statut :', genRes.status);
                return;
            }

            const { data: genData } = await genRes.json();
            console.log('Réponse APIBox reçue, genData :', genData);
            if (!genData.taskId) {
                console.log('Aucun taskId dans la réponse APIBox');
                return;
            }
            console.log('taskId obtenu :', genData.taskId);
            console.log('Processus /generate-music terminé');
            res.status(200).json({ message: 'Génération de la musique démarrée', taskId: genData.taskId });
        } catch (err) {
            console.log('Erreur inattendue dans /generate-music :', err);
            res.status(500).json({ error: 'Erreur interne serveur' });
        }
    })();
});

app.get('/', (req, res) => {
    res.send('API is running');
});

const server = app.listen(process.env.PORT || 8545);
server.timeout = 0;
console.log(`Server is running on port ${process.env.PORT || 8545}`);
