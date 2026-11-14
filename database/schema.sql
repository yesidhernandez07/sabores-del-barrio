CREATE DATABASE IF NOT EXISTS sabores_barrio CHARACTER SET utf8mb4;
USE sabores_barrio;
DROP TABLE IF EXISTS mermas, recetas, ventas, quejas, clientes, platos, ingredientes;

CREATE TABLE ingredientes (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(80), unidad VARCHAR(10), stock DECIMAL(10,2), stock_minimo DECIMAL(10,2));
CREATE TABLE platos (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(80), precio INT);
CREATE TABLE recetas (plato_id INT, ingrediente_id INT, cantidad DECIMAL(10,3), PRIMARY KEY(plato_id, ingrediente_id));
CREATE TABLE clientes (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(80), telefono VARCHAR(20), puntos INT DEFAULT 0);
CREATE TABLE ventas (id INT AUTO_INCREMENT PRIMARY KEY, plato_id INT, cantidad INT, canal ENUM('mesa','domicilio','evento'), cliente_id INT NULL, total INT,
  fecha DATETIME, hora_pedido DATETIME, hora_entrega DATETIME NULL);
CREATE TABLE mermas (id INT AUTO_INCREMENT PRIMARY KEY, ingrediente_id INT, cantidad DECIMAL(10,2), motivo VARCHAR(120), fecha DATETIME);
CREATE TABLE quejas (id INT AUTO_INCREMENT PRIMARY KEY, cliente_id INT NULL, origen ENUM('local','domicilio','redes'), descripcion TEXT,
  viral TINYINT DEFAULT 0, estado ENUM('abierta','en_gestion','resuelta') DEFAULT 'abierta', aprendizaje TEXT NULL, fecha DATETIME);

INSERT INTO ingredientes(nombre,unidad,stock,stock_minimo) VALUES ('Arroz','kg',20,5),('Pollo','kg',15,6),('Carne de res','kg',12,5),('Papa','kg',25,8),('Frijol','kg',10,4);
INSERT INTO platos(nombre,precio) VALUES ('Bandeja paisa',32000),('Pollo con arroz',22000),('Sancocho',26000),('Frijoles con garra',24000);
INSERT INTO recetas VALUES (1,3,0.25),(1,5,0.15),(1,1,0.12),(2,2,0.3),(2,1,0.15),(2,4,0.1),(3,2,0.25),(3,4,0.3),(4,5,0.3),(4,3,0.1);
INSERT INTO clientes(nombre,telefono,puntos) VALUES ('Laura Gómez','3001112233',12),('Carlos Ruiz','3104445566',5);
INSERT INTO ventas(plato_id,cantidad,canal,cliente_id,total,fecha,hora_pedido,hora_entrega) VALUES
(1,2,'mesa',1,64000,NOW()-INTERVAL 6 DAY,NOW()-INTERVAL 6 DAY,NULL),
(2,3,'domicilio',2,66000,NOW()-INTERVAL 5 DAY,NOW()-INTERVAL 5 DAY,NOW()-INTERVAL 5 DAY+INTERVAL 62 MINUTE),
(3,4,'evento',NULL,104000,NOW()-INTERVAL 3 DAY,NOW()-INTERVAL 3 DAY,NULL),
(1,1,'domicilio',1,32000,NOW()-INTERVAL 2 DAY,NOW()-INTERVAL 2 DAY,NOW()-INTERVAL 2 DAY+INTERVAL 35 MINUTE),
(2,5,'mesa',NULL,110000,NOW()-INTERVAL 1 DAY,NOW()-INTERVAL 1 DAY,NULL);
INSERT INTO quejas(cliente_id,origen,descripcion,viral,estado,fecha) VALUES (2,'domicilio','El pedido llegó una hora tarde y frío',0,'abierta',NOW());
