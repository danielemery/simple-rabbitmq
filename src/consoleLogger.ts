import ILogger from './ILogger';

export default class ConsoleLogger implements ILogger {
  debug(message: string, context?: any) {
    console.log(message, context);
  }

  info(message: string, context?: any) {
    console.log(message, context);
  }

  warn(message: string, context?: any) {
    console.log(message, context);
  }

  error(message: string, context?: any) {
    console.log(message, context);
  }
}
