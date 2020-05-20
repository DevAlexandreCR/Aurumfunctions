import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'
import { Constantes } from './Constantes/Constantes';
import { Player } from './Constantes/Player';
import { Match } from './Constantes/Match';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://aurumgamerco.firebaseio.com"
});

const db = admin.firestore()

export const newUser = functions.auth.user().onCreate((user, context) => {
    let id = user.uid
    let refDoc = db.collection(Constantes.PLAYER_COLLECTION).doc(id)
    let player = new Player()
    player.id = id
    player.date_addm = new Date()
    player.balance = 0
    player.email = user.email
    player.url_photo = 'https://firebasestorage.googleapis.com/v0/b/aurumgamerco.appspot.com/o/assets%2Fprofile_img.jpg?alt=media&token=0b6ece6c-5600-472d-bb7b-1585ed582f32'
    refDoc.set( Object.assign({}, player) ).then(res => {console.log(res)})
    .catch(err => {console.log('error al escribir en el documento player', err);
    })
})

function  isDataProfileComplete(player: Player): boolean {
  if (player.age === undefined || player.age < 15) { return false}
  else if (player.name === undefined || player.name.length < 6) { return false}
  else if (player.nickname === undefined ) { return false}
  else if (player.phone === undefined || player.phone.length > 10 || player.phone.length < 10) { return false}
  else { return true}
}

/**
 * paga el valor de la partida al ganador
 * inicialmente no cobra ninguna comision
 * @param match partida a terminar
 */
function endMatch(match: Match) {
  let winner_id: string = ''
  switch (match.winner) {
    case Constantes.MATCH_LOCAL:
      winner_id = match.local?.id!
    break
    case Constantes.MATCH_VISITANTE:
      winner_id = match.visitante?.id!
    break
  }
  db.doc(`${Constantes.PLAYER_COLLECTION}/${winner_id}`).get().then(doc => {
    if ( !doc.exists ) { console.log(' documento no existe'); return }
    else { 
      let player = new Player()
      player.balance = doc.get('balance')
      player.id = winner_id
      let balance = player.balance!
      balance = balance + match.oro!
      return db.doc(`${Constantes.PLAYER_COLLECTION}/${winner_id}`).set({balance: balance})
    }
  })
}

export const onUpdateProfile = functions.firestore.document(`${Constantes.PLAYER_COLLECTION}/{id}`)
.onUpdate((change, context) => {
  let id = context.params.id
  let player =  new Player()
  let data = change.after.data()
  if (data === undefined || data === null) { console.log('data after null'); return }
  player.age = data.age ? data.age: 0
  player.name = data.name 
  player.nickname = data.nickname
  player.phone = data.phone
  player.profile_complete = data.profile_complete
  if (isDataProfileComplete(player) && !player.profile_complete) {
    player.profile_complete = true
    db.doc(`${Constantes.PLAYER_COLLECTION}/${id}`).set( Object.assign({}, player), { merge: true })
    .then(res => { console.log('perfil completado exitosamente', res) })
    .catch(e => { console.log('error al completar el perfil', e);
    })
  }
})

export const onUpdateMatch = functions.firestore.document(`${Constantes.MATCH_COLLECTION}/{match_id}`)
.onUpdate((change, context) => {
  let match_id = context.params.match_id
  let match = new Match()
  let data = change.after.data()
  let data_before = change.before.data() // guardamos la data antes del cambio
  if (data === undefined || data === null) { console.log('data after null'); return }
  match.state = data.state
  if (data_before != undefined && data_before.state == Constantes.MATCH_PLAYING && data.state == Constantes.MATCH_END) { // verificamos si es solicitud de terminar partida
    match.score = data.score
    match.winner = data.winner
    match.local = data.local
    match.visitante = data.visitante
    match.id = match_id
    match.oro = data.oro
    endMatch(match)
  }
})

