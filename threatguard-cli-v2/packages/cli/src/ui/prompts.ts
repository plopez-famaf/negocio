import { createInterface } from 'readline';
import { stdin, stdout } from 'process';

export interface PromptOptions {
  message: string;
  required?: boolean;
  default?: string;
  choices?: string[];
}

export interface PasswordOptions {
  message: string;
  required?: boolean;
}

export interface ConfirmOptions {
  message: string;
  default?: boolean;
}

export class InputPrompt {
  private rl = createInterface({
    input: stdin,
    output: stdout,
  });

  async text(options: PromptOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const prompt = options.default 
        ? `${options.message} (${options.default}) ` 
        : `${options.message} `;

      this.rl.question(prompt, (answer) => {
        const finalAnswer = answer.trim() || options.default || '';
        
        if (options.required && !finalAnswer) {
          reject(new Error('This field is required'));
          return;
        }

        if (options.choices && !options.choices.includes(finalAnswer)) {
          reject(new Error(`Invalid choice. Must be one of: ${options.choices.join(', ')}`));
          return;
        }

        resolve(finalAnswer);
      });
    });
  }

  async password(options: PasswordOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const prompt = `${options.message} `;
      
      // Hide input for password
      stdout.write(prompt);
      stdin.setRawMode(true);
      stdin.resume();
      
      let password = '';
      
      const onData = (buffer: Buffer) => {
        const char = buffer.toString();
        
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl-D
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            stdout.write('\n');
            
            if (options.required && !password) {
              reject(new Error('Password is required'));
              return;
            }
            
            resolve(password);
            break;
          case '\u0003': // Ctrl-C
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            stdout.write('\n');
            reject(new Error('Cancelled'));
            break;
          case '\u007F': // Backspace
          case '\b':
            if (password.length > 0) {
              password = password.slice(0, -1);
              stdout.write('\b \b');
            }
            break;
          default:
            if (char.charCodeAt(0) >= 32) { // Printable characters
              password += char;
              stdout.write('*');
            }
            break;
        }
      };
      
      stdin.on('data', onData);
    });
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const defaultText = options.default !== undefined 
      ? (options.default ? 'Y/n' : 'y/N')
      : 'y/n';
    
    const answer = await this.text({
      message: `${options.message} (${defaultText})`,
      required: false,
    });

    if (!answer && options.default !== undefined) {
      return options.default;
    }

    const normalized = answer.toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  }

  async select(options: PromptOptions & { choices: string[] }): Promise<string> {
    console.log(`${options.message}`);
    options.choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice}`);
    });

    const answer = await this.text({
      message: 'Select an option (number)',
      required: true,
    });

    const index = parseInt(answer) - 1;
    if (isNaN(index) || index < 0 || index >= options.choices.length) {
      throw new Error('Invalid selection');
    }

    return options.choices[index];
  }

  close(): void {
    this.rl.close();
  }
}