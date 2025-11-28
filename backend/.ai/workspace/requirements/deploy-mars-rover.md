# User Story: Desplegar Rover

**Como** operador de la misión  
**Quiero** desplegar un rover en una posición específica de la cuadrícula  
**Para** iniciar la exploración del terreno marciano

## Criterios de Aceptación

### Escenario 1: Despliegue exitoso
```gherkin
Given una cuadrícula de 10x10
  And no hay obstáculos en la posición (3, 5)
When despliego un rover en la posición (3, 5) mirando al Norte
Then el rover se crea correctamente
  And su posición es (3, 5)
  And su orientación es Norte
```

### Escenario 2: Despliegue en el origen
```gherkin
Given una cuadrícula de 5x5
  And no hay obstáculos en la posición (0, 0)
When despliego un rover en la posición (0, 0) mirando al Este
Then el rover se crea correctamente
  And su posición es (0, 0)
  And su orientación es Este
```

### Escenario 3: Despliegue fuera de límites (coordenada X)
```gherkin
Given una cuadrícula de 10x10
When despliego un rover en la posición (15, 5) mirando al Norte
Then el despliegue falla
  And recibo un error indicando que las coordenadas están fuera de límites
```

### Escenario 4: Despliegue fuera de límites (coordenada Y)
```gherkin
Given una cuadrícula de 10x10
When despliego un rover en la posición (5, 20) mirando al Sur
Then el despliegue falla
  And recibo un error indicando que las coordenadas están fuera de límites
```

### Escenario 5: Despliegue con coordenadas negativas
```gherkin
Given una cuadrícula de 10x10
When despliego un rover en la posición (-1, 5) mirando al Oeste
Then el despliegue falla
  And recibo un error indicando que las coordenadas están fuera de límites
```

### Escenario 6: Despliegue sobre un obstáculo
```gherkin
Given una cuadrícula de 10x10
  And existe un obstáculo en la posición (4, 4)
When despliego un rover en la posición (4, 4) mirando al Norte
Then el despliegue falla
  And recibo un error indicando que hay un obstáculo en esa posición
```

### Escenario 7: Despliegue en el límite de la cuadrícula
```gherkin
Given una cuadrícula de 10x10
  And no hay obstáculos en la posición (9, 9)
When despliego un rover en la posición (9, 9) mirando al Sur
Then el rover se crea correctamente
  And su posición es (9, 9)
  And su orientación es Sur
```
