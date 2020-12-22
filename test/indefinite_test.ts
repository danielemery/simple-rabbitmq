import { map } from 'rxjs/operators';
import { observeRabbit, Rabbit } from '../index';
import ConsoleLogger from '../src/console-logger';
import { wait } from '../src/wait';
import printObservable from './print-observable';
import ITestMessage from './test-message';

async function runIndefiniteTest() {
  const rabbit = new Rabbit(
    {
      host: 'localhost',
      port: '5672',
      user: 'simple-rabbitmq',
      password: 'simple-rabbitmq',
    },
    undefined,
    {
      retry: true,
      retryWait: 1000,
    },
  );

  await rabbit.connect();

  const { observable } = await observeRabbit<ITestMessage>(
    rabbit,
    'indefinite_exchange',
    {
      queue: 'indefinite_listener',
    },
  );
  observable
    .pipe(
      map((envelope) => envelope.message),
      printObservable<ITestMessage>('Recieved Message'),
    )
    .subscribe();
  console.log('Now Listening');

  let message_no = 0;
  while (true) {
    try {
      rabbit.publish<ITestMessage>('indefinite_exchange', undefined, {
        text: `Message #${message_no}`,
      });
    } catch (err) {
      console.log(`Failed to publish message #${message_no}`);
    }
    message_no++;
    await wait(1000);
  }
}

console.log('Starting indefinite test');
runIndefiniteTest().catch((err) => {
  console.error(err);
});
