//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var watson = require('watson-developer-cloud');
var fs = require('fs');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);



router.use(express.static(path.resolve(__dirname, 'client')));
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false}));

var messages = [];
var sockets = [];
var _passo = [];
var _ultimaMsg = [];
var _nome = [];
var _cpf = [];
var _email =[];
var _dtNasc = [];
var _sexo =[];
var intencao =[];
var faces=0;


var visual_recognition = watson.visual_recognition({
  api_key: '27c534be631e0a876130e52ad002ae9a5392d55d',
  version: 'v3',
  version_date: '2016-05-20'
});

router.get('/webhook', function (req, res){
  
  if(req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === 'senhafacebook123'){
    console.log('validação OK!');
    res.status(200).send(req.query['hub.challenge']);
  }else{
    console.log('validação falhou!');
    res.sendStatus(403);
  }
  
});

router.post('/webhook', function (req, res){
  
  var data = req.body;
  
  if(data && data.object === 'page') {
    //PERCORRER TODAS AS ENTRADAS
    data.entry.forEach(function (entry){
      var pageID = entry.id;
      var timeOfEvent = entry.time;
      //PERCORRER TODAS AS MENSAGENS
      
      entry.messaging.forEach(function (event){
        console.log("event.message: "+ event.message);
        if (event.message){
          //Mensagens de Textos
          trataMensagem(event);
        } else {
          //Eventos de botões
          if (event.postback && event.postback.payload){
              //console.log("achamos um payload. Ele é: ", event.postback.payload)
              switch (event.postback.payload) {
                case 'clicou_comecar':
                  sendTextMessage(event.sender.id, "Olá, como posso te ajudar?");
                  sendMainMenu(event.sender.id);
                  break;
                case 'clicou_abrirConta':
                  sendTextMessage(event.sender.id, "Excelente, vamos começar a pegar seus dados, poderia me informar seu CPF?");
                  _ultimaMsg[event.sender.id] = "Preciso do seu CPF, pode me mandar por favor?";
                  _passo[event.sender.id] = "cpf";
                  break;
                case 'clicou_falarAgente':
                  sendTextMessage(event.sender.id, "Entendi..Vou direcionar você para um dos meus colegas, aguarde um minuto...");
                  break;
                default:
                  // code
              }
            
          }
        }
      })
      
    })
    res.sendStatus(200);
  }
  
  
});

function trataMensagem (event){
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  
  console.log("Mensagem Recebida do usuário %d pela página %d", senderID, recipientID);
  
  var messageID = message.id;
  var messageText = message.text;
  var attachments = message.attachments;
  
  if (messageText){
    console.log("entrou aqui");
    //Chama Watson para validar possiveis desvios
    chamarWatson(event);
    
    //Coloca timeout para dar tempo de aguardar retorno do Watson
    setTimeout(function(){
        if ((intencao[event.sender.id].intent === "Besteirol" || "Duvida" || "Tchau" || "Raiva" || "Bem_vindo" || "Negativo") &&
            intencao[event.sender.id].confidence >= 0.7){
          tratarDesvios(event);
        }else if(_passo[senderID]) {
          console.log("tratar passos");
          tratarPassos(event);
        } 
    }, 2000);
    
  }else{
    
    tratarPassosAnexos(event);
  }
}
    
  

function tratarDesvios(event){
  console.log("tratarDesvios: "+ intencao[event.sender.id].intent + " confidence: " + intencao[event.sender.id].confidence);
  switch (intencao[event.sender.id].intent) {
    case 'Bem_vindo':
      sendTextMessage(event.sender.id, "Olá, tudo bem?");
      _ultimaMsg[event.sender.id] = null
      setTimeout(function(){
        sendMainMenu(event.sender.id)    
        }, 2500);
      break;
    case 'Tchau':
      sendTextMessage(event.sender.id, "Obrigado pelo contato! Nos siga nas redes sociais");
      break;
    case 'Duvida':
      sendTextMessage(event.sender.id, "Veja se uma dessas opções pode te ajudar..");
      _ultimaMsg[event.sender.id] = null
      setTimeout(function(){
        sendMainMenu(event.sender.id)    
        }, 2500);
      break;
    case 'Besteirol':
      sendTextMessage(event.sender.id, "Ah, mas que bobagem...");
      setTimeout(function(){
          sendTextMessage(event.sender.id, _ultimaMsg[event.sender.id]);
        }, 2500);
      break;
    case 'Raiva':
      sendTextMessage(event.sender.id, "Não fique irritado...");
      setTimeout(function(){
          sendTextMessage(event.sender.id, _ultimaMsg[event.sender.id]);
        }, 2500);
      break;
      
    case 'Negativo':
      sendTextMessage(event.sender.id, "Ah, vamos lá, quero te ajudar...");
      setTimeout(function(){
          sendTextMessage(event.sender.id, _ultimaMsg[event.sender.id]);
        }, 2500);
      break;
    
    
    default:
      // code
  }
  
  
}

function tratarPassos(event){
  
  
  switch (_passo[event.sender.id]) {
        case 'cpf':
          //validar CPF
          sendTextMessage(event.sender.id, "Anotei, poderia me passar agora o seu email??");
          _ultimaMsg[event.sender.id] = "Poderia me passar seu email por favor?";
          _passo[event.sender.id] = "email";
          break;
        
        case 'email':
          //validar Email
          sendTextMessage(event.sender.id, "Excelente. Agora preciso da sua data de nascimento...");
          _ultimaMsg[event.sender.id] = "Qual sua data de nascimento?";
          _passo[event.sender.id] = "dtnasc";
          break;
         
         case 'dtnasc':
         //validar Data de Nascimento
          sendTextMessage(event.sender.id, "Nossa que jovem...Poderia me dizer seu sexo?");
          _ultimaMsg[event.sender.id] = "qual seu sexo?";
          _passo[event.sender.id] = "sexo";
          break;  
        
        case 'sexo':
          //validar sexo
          sendTextMessage(event.sender.id, "Estamos quase no fim.. Pode tirar uma foto de um documento seu? Pode ser sua CNH ou RG");
          _ultimaMsg[event.sender.id] = "Pode me mandar uma foto de um de seus documentos? Pode ser a CNH ou o RG";
          _passo[event.sender.id] = "doc";
          break;
          
        case 'doc':
        case 'video':
        sendTextMessage(event.sender.id, "Estava esperando receber um anexo...");
        setTimeout(function(){
            sendTextMessage(event.sender.id, _ultimaMsg[event.sender.id]);
        }, 2500);
          break;
        
        default:
          // code
      }
}


function showOptionsMenu(recipientId){
  
  setTimeout(function(){
    //colocar mensagem 
    
  }, 2500)
  
  
}

function tratarPassosAnexos(event){
  
    var messageAttachments = event.message.attachments;
 
    if (messageAttachments) {
      switch (_passo[event.sender.id]) {
        case 'doc':
          //Realiza tratamento de foto
          if (messageAttachments[0].type === "image"){
            messageAttachments.forEach(function(messageAttachment) {
            var attachmentUrl = messageAttachment.payload.url;
            console.log("Received Attachment: " + attachmentUrl );
            sendTextMessage(event.sender.id, "Recebi sua foto, vou apenas validar com meu chefe, e já te retorno, pera ai.");
            faceDetection(attachmentUrl);
            });
            setTimeout(function(){
              console.log("faces: "+ faces);
              var msg;
              if (faces ==0){
                msg = "Não encontrei ninguém nessa foto, pode me mandar outra?";
                _ultimaMsg[event.sender.id] = "Poderia por favor me mandar sua foto?";
              }else if(faces == 1)
              {
                msg = "Legal, gostei da foto...Pode me passar agora um vídeo seu?";
                _ultimaMsg[event.sender.id] = "Poderia por favor me mandar um video seu? ";
                _passo[event.sender.id] = "video";
              }else{
                msg = "Encontrei mais de uma pessoa nessa foto, pode me mandar uma outra só sua?";
                _ultimaMsg[event.sender.id] = "Poderia por favor me mandar sua foto?";  
              }
            sendTextMessage(event.sender.id, msg);
            }, 8000);
          }
            else
            {
            msg = "O que me mandou não parece ser uma foto, pode me mandar uma foto por favor?";
              _ultimaMsg[event.sender.id] = "Poderia por favor me mandar sua foto?";
              sendTextMessage(event.sender.id, msg);
            }
            
            break;      
            
            case 'video':
            if (messageAttachments[0].type === "video"){
              var msg = "Pronto, concluímos seu cadastro, agora é só esperar...Posso te ajudar em mais alguma coisa?";
              sendTextMessage(event.sender.id, msg);
              _ultimaMsg[event.sender.id] = msg;
              _passo[event.sender.id] = null;
              setTimeout(function(){
                sendMainMenu(event.sender.id)    
              }, 2500);
            }else{
              msg = "O que me mandou não parece ser um vídeo, pode me mandar um video por favor?";
              _ultimaMsg[event.sender.id] = "Poderia por favor me mandar um video seu?";
              sendTextMessage(event.sender.id, msg);
            }
            break;
            default:
            sendTextMessage(event.sender.id, "Não estava esperando um anexo...");
            setTimeout(function(){
                sendTextMessage(event.sender.id, _ultimaMsg[event.sender.id]);
            }, 2500);
      }
    } else {
      console.log("Erro! Tipo de mensagem não identificada" + event);
      sendTextMessage(event.sender.id, "Não entendi, poderia tentar novamente?");
      setTimeout(function(){
          sendTextMessage(event.sender.id, _ultimaMsg[event.sender.id]);
        }, 2500);
    }

}

function faceDetection (attachmentUrl){
  
  var params = {
    url: attachmentUrl,
    images_file: null
};
  console.log("passou aqui 1");
  
var retorno;

visual_recognition.detectFaces(params,
  function(err, response) {
    if (err)
      console.log("erro:" + err);
    else{
      retorno = response;
      //retorno = JSON.stringify(response, null, 2);
        //setTimeout(function(){
        console.log("passou aqui 2");
        console.log("retorno: " + JSON.stringify(response, null, 2));

        //console.log("retorno: " + retorno);
        faces = Object.keys(retorno.images[0].faces).length;
  //}, 8000);
      
      
    }
  });
}


function sendMainMenu(recipientId){
  var MessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload:{
          template_type: "button",
          text: "Veja as opções",
          buttons: [
            {
               type: "web_url",
               url: "https://www.original.com.br",
               title: "acesse nosso site!"
            },
            {
              type: "postback",
              title: "Abrir conta",
              payload: "clicou_abrirConta"
            },
            {
              type: "postback",
              title: "Falar com agente",
              payload: "clicou_falarAgente"
            }
            
            ]
        }
      }
    }
  };
  
  callSendAPI(MessageData);  
  
}


function sendTextMessage (recipientId, messageText){
  var MessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  
  callSendAPI(MessageData);
  
}

function callSendAPI (messageData){
  
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: 'EAAHSON7d120BAIzI6ApE87BcQ1n6eeUaFRNxMuJCgoZBQEGMok98f8GVZAZCtoJUW2QVc33SSYqQ3a3t42TQKZC8YaAG4LtDZBtG0f8PV4ZA55xiXZB52lZC4SLTw52Bkn52TS8XU7v4fuGL1ZCOPrbGj17ZAE3kEWKpMHsZAGArtw0OwZDZD' },
    method: 'POST',
    json: messageData
  }, function (error, response, body){
    
    if(!error && response.statusCode == 200){
      console.log('Mensagem enviada com sucesso');
      var recipientID = body.recipient_id;
      var messageID = body.message_id;
    } else {
      console.log('Nao foi possivel enviar a mensagem');
      console.log("messageData: "+ messageData);
      console.log("error: " + error);
    }
    
  })
  
}



function chamarWatson(event){

var ConversationV1 = require('watson-developer-cloud/conversation/v1');
// cria wrapper service.
var conversation = new ConversationV1({
  username: '4d7f3bbc-7aa6-475f-afbc-a40a1b2f1f87', // replace with username from service key
  password: 'aemtIneH6eZo', // replace with password from service key
  path: { workspace_id: '78257d9f-593a-4077-bafb-c276e87ebfdc' }, // replace with workspace ID
  version_date: '2016-07-11'
});

//Formata mensagem
conversation.message({
      input: { text: event.message.text }
    }, processResponse);

// processa response
function processResponse(err, response) {
  if (err) {
    console.error(err); // something went wrong
    return;
  }

//Formata mensagem - Com Contexto
// conversation.message({
//       input: { text: textMessage },
//       context : response.context,
//     });


    // loga Intent identifcada
  if (response.intents.length > 0) {
    console.log('Detected intent: #' + response.intents[0].intent);
    intencao[event.sender.id] = response.intents[0];
    //console.log("watson: ", intencao);
  }

  // Exibir mensagens de retorno do Watson
  // if (response.output.text.length != 0) {
  //     console.log(response.output.text[0]);
  // }
  

}
}

////fim watson











//ROTINAS PADRÕES!!!!
io.on('connection', function (socket) {
    messages.forEach(function (data) {
      socket.emit('message', data);
    });

    sockets.push(socket);

    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
      updateRoster();
    });

    socket.on('message', function (msg) {
      var text = String(msg || '');

      if (!text)
        return;

      socket.get('name', function (err, name) {
        var data = {
          name: name,
          text: text
        };

        broadcast('message', data);
        messages.push(data);
      });
    });

    socket.on('identify', function (name) {
      socket.set('name', String(name || 'Anonymous'), function (err) {
        updateRoster();
      });
    });
  });

function updateRoster() {
  async.map(
    sockets,
    function (socket, callback) {
      socket.get('name', callback);
    },
    function (err, names) {
      broadcast('roster', names);
    }
  );
}

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});
