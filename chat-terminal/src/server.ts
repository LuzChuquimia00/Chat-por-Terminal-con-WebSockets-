import { WebSocketServer, WebSocket } from 'ws';
import chalk from 'chalk';
import readline from 'readline';

interface Client {
    socket: WebSocket;
    username: string;
}

const PORT = 8080;
const clients = new Set<Client>();
const usernames = new Set<string>(); // Para controlar nombres únicos
const wss = new WebSocketServer({ port: PORT });

// Limpiar terminal
function clearTerminal() {
    console.clear();
    console.log(chalk.green.bold(`🚀 Servidor de chat reiniciado en ws://localhost:${PORT}`));
}

// Función mejorada de broadcast
function broadcast(message: string, sender?: WebSocket, serverLog: boolean = true) {
    if (serverLog) {
        const isServerMsg = message.startsWith('[Servidor]:');
        console.log(isServerMsg ? chalk.magenta(message) : message);
    }

    // Limpieza eficiente de conexiones cerradas
    const closedClients = Array.from(clients).filter(client => 
        [WebSocket.CLOSED, WebSocket.CLOSING].includes(client.socket.readyState)
    );
    closedClients.forEach(client => {
        clients.delete(client);
        usernames.delete(client.username);
    });

    // Envío eficiente a clientes conectados
    Array.from(clients).forEach(client => {
        if (client.socket !== sender && client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(message);
        }
    });
}

// Función de cierre mejorada
async function gracefulShutdown(message: string = 'Cierre programado') {
    console.log(chalk.red.bold(`\n${message}`));
    
    // 1. Notificar a todos los clientes
    broadcast('[Servidor]: El servidor se está cerrando...', undefined, false);
    
    // 2. Cerrar todas las conexiones de clientes
    const closePromises = Array.from(clients).map(client => {
        return new Promise<void>(resolve => {
            if (client.socket.readyState === WebSocket.OPEN) {
                client.socket.once('close', resolve);
                client.socket.close(1001, 'Server shutdown');
            } else {
                resolve();
            }
        });
    });
    
    await Promise.all(closePromises);
    
    // 3. Cerrar el servidor WebSocket
    return new Promise<void>(resolve => {
        wss.close(() => {
            console.log(chalk.red('✅ Servidor cerrado correctamente'));
            clearTerminal(); // Limpiar terminal al cerrar
            resolve();
        });
    });
}

// Manejo de conexiones
wss.on('connection', (ws: WebSocket) => {
    let username = '';
    let registered = false;

    ws.on('message', (data: string) => {
        try {
            const message = data.toString().trim();
            
            if (!registered) {
                // Validación de nombre de usuario único
                if (usernames.has(message)) {
                    ws.send('[Servidor]: Error: Nombre de usuario ya en uso. Por favor, elige otro.');
                    ws.close();
                    return;
                }

                // Registro de nuevo usuario
                username = message;
                registered = true;
                clients.add({ socket: ws, username });
                usernames.add(username);
                
                console.log(chalk.yellow(`→ ${username} conectado`));
                broadcast(`[Servidor]: ${username} se ha unido al chat.`);
                
                ws.send(`✅ Conectado como "${username}"\n\nEscribe tu mensaje:`);
                return;
            }
            
            // Caso de Uso 2: Mensaje de chat
            if (message) {
                // 1. SOLO MOSTRAR EN SERVIDOR (con emoji)
                console.log(chalk.blue(`✉️  ${username}: ${message}`));
                
                // 2. SOLO ENVIAR A CLIENTES (sin mostrar en servidor)
                Array.from(clients).forEach(client => {
                    if (client.socket !== ws && client.socket.readyState === WebSocket.OPEN) {
                        client.socket.send(`${username}: ${message}`);
                    }
                });
            }
        } catch (error) {
            console.error(chalk.red('Error procesando mensaje:'), error);
        }
    });

    // Caso de Uso 3: Desconexión
    ws.on('close', () => {
        if (registered) {
            console.log(chalk.yellow(`← ${username} desconectado`));
            clients.delete({ socket: ws, username });
            usernames.delete(username);
            broadcast(`[Servidor]: ${username} ha salido del chat.`);
        }
    });

    ws.on('error', (error) => {
        console.error(chalk.red(`⚠️ Error con ${username || 'cliente'}:`), error);
        if (registered) {
            usernames.delete(username);
        }
    });
});

// Consola administrativa
const admin = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

admin.on('line', (input) => {
    if (input === '/shutdown') {
        gracefulShutdown('Cierre por comando administrativo').then(() => process.exit(0));
    } else if (input === '/clear') {
        clearTerminal();
    } else if (input === '/users') {
        console.log('Usuarios conectados:', Array.from(usernames).join(', '));
    }
});

// Caso de Uso 4: Cierre programado
clearTerminal();

const SHUTDOWN_WARNING_TIME = 30000; // 30 segundos para mensaje
const SHUTDOWN_DELAY = 400000; // 6 minutos después del aviso

setTimeout(() => {
    const warningMsg = '[Servidor]: El servidor se cerrará en 6 minutos.';
    console.log(chalk.red.bold(warningMsg));
    broadcast(warningMsg, undefined, false);
    
    setTimeout(() => {
        gracefulShutdown('Tiempo de cierre completado').then(() => process.exit(0));
    }, SHUTDOWN_DELAY);
}, SHUTDOWN_WARNING_TIME);