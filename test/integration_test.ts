import { Rabbit } from '../index';

async function runIntegrationTest() {
  const rabbit = new Rabbit({
    host: 'localhost',
    port: '5672',
    user: 'simple-rabbitmq',
    password: 'simple-rabbitmq',
  });
  await rabbit.connect();
  const listener = await rabbit.listen(
    'test_exchange',
    '',
    '',
    message => {
      console.log(`Recieved message ${JSON.stringify(message)}.`);
    },
    () => {
      console.log('Listener cancelled');
    },
  );
  for (let i = 0; i < 10; i++) {
    console.log(`Publishing Message ${i}`);
    await rabbit.publish('test_exchange', '', {
      text: `Test Message ${i}`,
    });
  }
  await rabbit.unlisten(listener);
  for (let i = 0; i < 10; i++) {
    console.log(`Publishing Message ${i}`);
    await rabbit.publish('test_exchange', '', {
      text: `Test Message ${i}`,
    });
  }
  await rabbit.deleteExchange('test_exchange');
  await rabbit.disconnect();
  return;
}

console.log('Starting integration test');
runIntegrationTest()
  .then(() => console.log('Integration test completed successfully.'))
  .catch(err => {
    console.error(err);
  });
