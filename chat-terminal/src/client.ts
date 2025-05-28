import WebSocket from 'ws';
import readline from 'readline';
import chalk from 'chalk';

const SERVER_URL = 'ws://localhost:8080';

function startClient() {
    console.log(chalk.green.bold('Bienvenido al Chat Terminal\n'));
    console.log(chalk.cyan('Por favor, ingresa tu nombre de usuario:'));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('', (username) => {
        const ws = new WebSocket(SERVER_URL);
        let connected = false;

        ws.on('open', () => {
            connected = true;
            ws.send(username.trim());
            console.log(chalk.yellow(`\nConectado como "${username}"`));
            console.log(chalk.gray('Escribe tu mensaje (/exit para salir)\n'));
            
            rl.on('line', (input) => {
                if (!connected) return;
                
                if (input.trim().toLowerCase() === '/exit') {
                    ws.close();
                    rl.close();
                    return;
                }
                
                if (input.trim()) {
                    ws.send(input);
                }
            });
        });
        
        ws.on('message', (data: string) => {
            const message = data.toString();
            if (message.startsWith('[Servidor]:')) {
                console.log(chalk.magenta(message));
            } else {
                console.log(message);
            }
        });
        
        ws.on('close', () => {
            connected = false;
            console.log(chalk.yellow('\nDesconectado del servidor'));
            rl.close();
        });
        
        ws.on('error', (error) => {
            connected = false;
            console.error(chalk.red('Error de conexión:'), error.message);
            rl.close();
        });
    });
}

startClient();