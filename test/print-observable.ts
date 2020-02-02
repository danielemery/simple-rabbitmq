import { map } from 'rxjs/operators';

export default function printObservable<T>(message: string) {
  return map<T, T>(value => {
    console.log(`${message} ${JSON.stringify(value)}.`);
    return value;
  });
}
