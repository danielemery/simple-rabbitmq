import ILogger from './logger';

export default class ConsoleLogger implements ILogger {
  private log(message: string, context?: any) {
    if (context) {
      console.log(message, context);
    } else {
      console.log(message);
    }
  }

  debug(message: string, context?: any) {
    this.log(message, context);
  }

  info(message: string, context?: any) {
    this.log(message, context);
  }

  warn(message: string, context?: any) {
    this.log(message, context);
  }

  error(message: string, context?: any) {
    this.log(message, context);
  }
}
