import { Observable } from 'rxjs';
import Rabbit from './rabbit';

export default function<T>(
  rabbit: Rabbit<T>,
  exchange: string,
  routingKey?: string,
  queue?: string,
): Observable<T> {
  return new Observable(observer => {
    rabbit.listen(
      exchange,
      routingKey,
      queue,
      message => {
        observer.next(message);
      },
      () => {
        observer.complete();
      },
    );
  });
}
