import figlet from 'figlet';

export async function welcomeBanner() {
  console.clear();
  await figlet.text(
    'Mycelium SDK',
    {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 100,
      whitespaceBreak: true,
    },
    function (err, data) {
      if (err) {
        console.log('Something went wrong...');
        console.dir(err);
        return;
      }
      console.log(data);
    },
  );
}
