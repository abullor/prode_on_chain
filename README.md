# Prode On Chain

El proyecto consiste en un prode para el mundial de Qatar 2022, aprovechando la transparencia que aporta la blockchain para que las reglas y condiciones sean visibles y verificables de antemano por todos los participantes. 

El mundial está compuesto por 32 equipos, divididos en 8 zonas de 4 equipos cada una. La primera
fase consta de 48 partidos a disputarse entre los días 20/11/2022 y 2/12/2022.

La boleta tiene un precio fijo de 1 ETH para participar, asignando el 80% al pozo que se entregará como premio, y un 20% a los gastos de gestión. 

Quién desee participar, deberá transferir el costo de la boleta junto con su apuesta antes del inicio del mundial. Para cada uno de los 48 partidos deberá
indicarse si quien gana es el equipo local, hay empate o vence el equipo visitante, entregando un
punto por cada acierto.

Finalizada la primera fase y teniendo calculados los aciertos de los usuarios, el ganador del pozo
será aquel que más puntos haya obtenido. Si hubiera más de un usuario con la misma cantidad
máxima de puntos, el pozo se dividirá entre todos ellos.

La boleta de la apuesta se representará minteando un NFT, cuyo dueño podrá “venderla” a quién esté
interesado en la misma en caso de que su predicción sea candidata a ganar el pozo.

## Contratos
- ProdeToken. Es un ERC721 que representa la boleta. Guarda la info on-chain.
- ProdeLogic. Es el contrato con la lógica para recibir apuestas y validarlas, recibir actualización de resultados, calcular puntos y premios, y recibir pedidos de cobro de premios.
- MultiSig. Es una implementación de MultiSig, quedando como dueño de ProdeToken, lo que lo habilita a ser el único en condiciones de ejecutar las funciones de carga de resultado y de cálculo de puntos cuando cuente con las autorizaciones requeridas. 

## Reglas destacadas
- Sólo podrán recibirse apuestas hasta la fecha indicada en el tercer argumento del constructor de ProdeLogic. Cualquier intento posterior será rechazado.
- El costo de la boleta es de 1 ETH. Cualquier intento de apuesta con un valor distinto será rechazado.
- La apuesta debe incluir los 48 partidos de primera fase, cualquier partido que no tenga predicción provocará que la boleta sea rechazada. 
- La apuesta se indica como un número decimal, cuya representación binaria se utilizará para indicar los resultados de los partidos en términos de local (01), empate (10) o visitante (11). Por ejemplo, para representar la apuesta por los primeros 3 partidos podríamos usar el número 54. Pasado a decimal es 110110. Leído de derecha a izquierda nos indica que la apuesta para el primer partido es 01 (local), para el segundo es empate (10) y para el tercero es visitante (11).
- No podrá consultarse los ganadores ni el premio correspondiente a cada uno hasta tanto se hayan calculado los puntos una vez finalizada la primera fase.
- Se validará que a la hora de cargar un resultado el mismo corresponda a un partido válido, con un resultado válido (local, empate, visitante o suspendido), y que el partido haya terminado. No podrá ingresarse el resultado más de una vez para un mismo partido, y si el mismo fuera suspendido, deja de considerarse a la hora de calcular los puntos por más que se decida un cambio de fecha o alguna otra circunstancia de fuerza mayor.
- El flujo del MultiSig consiste en cargar transacciones, autorizarlas y luego ejecutarlas. Sólo las firmas autorizadas podrán cargar transacciones. Al momento de autorizarlas se validará que exista la transacción, no se haya ejecutado ni se haya autorizado previamente. Para ejecutar la transacción, se validará que exista, que no haya sido ejecutada previamente, y que cuente con las autorizaciones requeridas. 
- Para el cobro de premios se implementa el patrón Withdrawal, siendo los dueños de las boletas quienes retirarán su premio, validándose que efectivamente sean ganadores, que sean los dueños de la boleta, y que la misma no haya sido cobrada anteriormente.

## Eventos a registrar
- Cada vez que se guarde una apuesta con los datos del sender, el id de nft y la apuesta en sí.
- Cada vez que se guarde un resultado con los datos del sender, el id de partido y el resultado ingresado.
- El momento en el que se hayan terminado de calcular los puntos con los datos del sender y la cantidad de ganadores.
- Cada vez que se pague un premio con los datos de el destinatario, el id de nft y el monto del premio.

Ejecución de test unitarios
```shell
npx hardhat test
GAS_REPORT=true npx hardhat test
```
Ejecución de test unitarios con reporte de GAS
```shell
GAS_REPORT=true npx hardhat test
```
Ejecución de informe de cobertura
```shell
npx hardhat coverage
npx hardhat node
npx hardhat run scripts/deploy-local.ts
```
Despliegue en nodo local
```shell
npx hardhat node
npx hardhat run --network localhost scripts/deploy-local.ts
```
Despliegue en testnet (en este script de ejemplo se settea un único signer al MultiSig)
```shell
MULTISIG_OWNER_ADDRESS= ALCHEMY_API_KEY= GOERLI_PRIVATE_KEY= ETHERSCAN_API_KEY= npx hardhat run --network goerli scripts/deploy-testnet.ts
```