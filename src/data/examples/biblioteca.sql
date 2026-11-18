SELECT DISTINCT L.titulo, A.nombre
FROM Libro AS L
INNER JOIN Autor AS A
ON L.id_autor = A.id_autor
WHERE L.anio > 2020
AND A.pais = 'México';
