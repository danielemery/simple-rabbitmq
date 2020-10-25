import { range } from 'rxjs';
import { map } from 'rxjs/operators';

import { Rabbit, observeRabbit, publishObservable } from '../index';
import ITestMessage from './test-message';
import printObservable from './print-observable';

export default async function noAckTest(rabbit: Rabbit) {
  await rabbit.connect();

  const { observable, cancel } = await observeRabbit<ITestMessage>(
    rabbit,
    'test_exchange',
    {
      requiresAcknowledge: false,
    },
  );
  console.log('Now Listening');

  observable
    .pipe(
      map((envelope) => envelope.message),
      printObservable<ITestMessage>('Recieved Message'),
    )
    .subscribe();

  await range(0, 10)
    .pipe(
      map((num) => ({
        text: `Test Message ${num}`,
      })),
      printObservable<ITestMessage>('Sent Message'),
      publishObservable<ITestMessage>(rabbit, 'test_exchange'),
    )
    .toPromise();

  await cancel();
  console.log('No Longer Listening');

  await rabbit.deleteExchange('test_exchange');
  await rabbit.disconnect();
}
