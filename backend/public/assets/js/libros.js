// public/script.js
// Importamos CartManager
import { CartManager } from './CartManager.js';
import { checkBookAvailability } from './stockService.js';
import { requireUserSession } from './sessionService.js';

// Asumiendo SweetAlert2 está disponible globalmente (incluido en HTML o otro script)
// import Swal from 'sweetalert2';

const BAD_WORDS = [
  "tonto", "idiota", "estupido", "imbécil", "mierda", "puta", "pendejo", "cabron", "gilipollas"
];

function censorBadWords(text) {
  let censored = text;
  BAD_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    censored = censored.replace(regex, match => '*'.repeat(match.length));
  });
  return censored;
}

// Ejemplo en fetchAndRenderReviews:
function renderReviewHTML(review) {
  return `
    <div class="review" data-review-id="${review._id}">
      <strong>${review.user || 'Anónimo'}</strong>
      <p>${censorBadWords(review.text)}</p>
      <div class="comments-section">
        ${(review.comments || []).map(comment => `
          <div class="comment" data-comment-id="${comment._id}">
            <strong>${comment.user}</strong>
            <p>${censorBadWords(comment.text)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Función asíncrona para obtener los detalles del libro desde la API del back-end y renderizarlos
async function fetchAndRenderBookDetails() {
    // Obtener el ID del libro de la URL
    const params = new URLSearchParams(window.location.search);
    // Obtenemos el ID. Ahora esperamos que sea el _id de MongoDB, que es un string.
    const bookId = params.get('id');

    const bookDetailsContainer = document.getElementById('book-details');

    if (!bookId) {
        // Manejar el caso donde no hay ID en la URL
        if (bookDetailsContainer) {
            bookDetailsContainer.innerHTML = '<p>Error: No se especificó ID de libro en la URL.</p>';
        }
        console.error("No se proporcionó ID de libro en la URL.");
        return; // Salir de la función
    }

    // Mostrar un mensaje de carga mientras se obtiene la data
    if (bookDetailsContainer) {
         bookDetailsContainer.innerHTML = '<p>Cargando detalles del libro...</p>';
         // Mostrar el formulario solo si hay usuario logueado
const user = JSON.parse(sessionStorage.getItem('user'));
if (user && user.name) {
  document.getElementById('review-form-section').style.display = 'block';
}

    }

    try {
        // Hacer la solicitud al back-end para obtener los datos del libro
        // La URL debe apuntar a tu servidor back-end y al endpoint /api/books/ seguido del ID.
        // Usamos window.location.origin para obtener la parte inicial de la URL (ej: http://localhost:5000)
        // y luego añadimos la ruta de la API y el ID.
        const apiUrl = `${window.location.origin}/api/books/${bookId}`;

        console.log(`Workspaceing book from: ${apiUrl}`); // Para depuración

        const response = await fetch(apiUrl);

        if (!response.ok) {
            // Si la respuesta no es exitosa (ej. 404 Not Found, 500 Internal Server Error)
            // Intentamos leer el mensaje de error del JSON de respuesta si existe
            const errorData = await response.json().catch(() => ({ message: response.statusText })); // Fallback al texto del estado
            const errorMessage = errorData.message;

            if (bookDetailsContainer) {
                if (response.status === 404) {
                    bookDetailsContainer.innerHTML = '<p>Libro no encontrado.</p>';
                } else {
                    bookDetailsContainer.innerHTML = `<p>Error al cargar los detalles del libro: ${errorMessage}</p>`;
                }
            }
            console.error(`Error fetching book ${bookId}: ${response.status} - ${errorMessage}`);
            return; // Salir de la función
        }

        // Si la respuesta es OK (status 2xx)
        const book = await response.json(); // Parsear la respuesta JSON a un objeto JavaScript

        // Ahora que tenemos el objeto 'book' del back-end, renderizamos los detalles
        if (bookDetailsContainer) { // Verificar si el elemento existe antes de manipularlo
            bookDetailsContainer.innerHTML = `
                <div class="book-detail">
                    <img src="${book.image}" alt="${book.title}">
                    <div class="info">
                        <h1>${book.title}</h1>
                        <p class="category">Categoría: ${book.category}</p>
                        <p class="description">${book.description}</p>
                        <p class="price">
                            Precio:
                            ${book.isDiscounted ? `<span class="original-price">$${book.originalPrice}</span>` : ''}
                            $${book.price}
                        </p>
                        <p class="delivery-time">Tiempo de entrega: ${book.deliveryTime}</p>
                        <div class="quantity">
                            <label for="quantity">Cantidad:</label>
                            <input type="number" id="quantity" value="1" min="1">
                        </div>
                    </div>
                    <div class="actions">
                        <button id="add-to-cart">Añadir al Carrito</button>
                        <button id="buy-now">Comprar Ahora</button>
                    </div>
                </div>
            `;

            // --- Agregar eventos a los botones DESPUÉS de que se ha renderizado el HTML ---
            // Es crucial seleccionar los botones *después* de que innerHTML ha actualizado el DOM.
            const addToCartButton = document.getElementById('add-to-cart');
            if (addToCartButton) {
                addToCartButton.addEventListener('click', async () => {
                    if (!requireUserSession()) return;
                    const quantityInput = document.getElementById('quantity');
                    const quantity = parseInt(quantityInput.value) || 1;
                    const cartManager = new CartManager();
                    const cartItem = cartManager.cart.find(i => (i._id || i.id) === book._id);
                    const cantidadExistente = cartItem?.quantity || 0;
                    const tieneStock = await checkBookAvailability(book._id, quantity + cantidadExistente);
                    if (!tieneStock) {
                      Swal.fire({
                        icon: 'error',
                        title: 'Sin stock',
                        text: `Solo hay ${book.quantity} unidades disponibles de "${book.title}".`,
                        toast: true,
                        position: 'top-end',
                        timer: 2500,
                        showConfirmButton: false
                      });
                      return;
                    }
                    for (let i = 0; i < quantity; i++) {
                      cartManager.addItem(book);
                    }
                  
                    Swal.fire({
                      icon: 'success',
                      title: 'Añadido al carrito',
                      text: `"${book.title}" se ha añadido al carrito ${quantity} ${quantity === 1 ? 'vez' : 'veces'}.`,
                      timer: 2000,
                      showConfirmButton: false,
                      toast: true,
                      position: 'top-end'
                    });
                  });
                  
            }


            const buyNowButton = document.getElementById('buy-now');
             if (buyNowButton) {
                buyNowButton.addEventListener('click', async () => {
                    if (!requireUserSession()) return;
                    const quantityInput = document.getElementById('quantity');
                    const quantity = parseInt(quantityInput.value) || 1;
                    const cartManager = new CartManager();
                    const cartItem = cartManager.cart.find(i => (i._id || i.id) === book._id);
                    const cantidadExistente = cartItem?.quantity || 0;
                    const tieneStock = await checkBookAvailability(book._id, quantity + cantidadExistente);
                    if (!tieneStock) {
                      Swal.fire({
                        icon: 'error',
                        title: 'Sin stock',
                        text: `Solo hay ${book.quantity} unidades disponibles de "${book.title}".`,
                        toast: true,
                        position: 'top-end',
                        timer: 2500,
                        showConfirmButton: false
                      });
                      return;
                    }
                    for (let i = 0; i < quantity; i++) {
                      cartManager.addItem(book);
                    }
                  
                    const redirectUrl = cartManager.handleCheckout();
                    if (redirectUrl) {
                      window.location.href = redirectUrl;
                    } else {
                      console.warn("handleCheckout no retornó una URL de redirección.");
                    }
                  });
                  
             }
             await fetchAndRenderReviews(book._id);

        }

    } catch (error) {
        // Manejar errores generales de la solicitud fetch (ej. problema de red, servidor caído)
        console.error('Error general al obtener datos del libro:', error);
         if (bookDetailsContainer) {
            bookDetailsContainer.innerHTML = '<p>Error al cargar los detalles del libro. Intente nuevamente más tarde.</p>';
        }
    }
}

async function fetchAndRenderReviews(bookId) {
    // Si ya existe una sección de reseñas, elimínala
    let reviewsContainer = document.querySelector('.reviews-section');
    if (reviewsContainer) {
        reviewsContainer.remove();
    }

    // Crear una nueva sección
    reviewsContainer = document.createElement('div');
    reviewsContainer.className = 'reviews-section';

    const bookDetailsContainer = document.getElementById('book-details');

    try {
        const response = await fetch(`${window.location.origin}/api/reviews?libro=${bookId}`);

        if (!response.ok) throw new Error('Error al obtener las reseñas');

        const reviews = await response.json();

        if (reviews.length === 0) {
            reviewsContainer.innerHTML = '<p>No hay reseñas aún.</p>';
        } else {
            const average = (
                reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
            ).toFixed(1);

            reviewsContainer.innerHTML = `
                <h2>Reseñas (${reviews.length})</h2>
                <p>Calificación promedio: ${average} ★</p>
                ${reviews.map(r => {
                    const date = new Date(r.createdAt).toLocaleDateString('es-ES', {
                        year: 'numeric', month: 'long', day: 'numeric'
                    });

                    return `
                        <div class="review" data-review-id="${r._id}">
                            <strong>${r.user || 'Anónimo'}</strong> - <span style="font-size: 0.9em; color: #777;">${date}</span>
                            <p>${censorBadWords(r.text)}</p>
                            <p>★ ${r.rating}</p>
                            
                            <!-- Sección de comentarios -->
                            <div class="comments-section">
                                <h4>Comentarios (${r.comments ? r.comments.length : 0})</h4>
                                <div class="comments-list" id="comments-${r._id}">
                                    ${r.comments && r.comments.length > 0 ? 
                                        r.comments.map(comment => {
                                            const commentDate = new Date(comment.createdAt).toLocaleDateString('es-ES');
                                            return `
                                                <div class="comment" data-comment-id="${comment._id}">
                                                    <strong>${comment.user}</strong> - <span style="font-size: 0.8em; color: #999;">${commentDate}</span>
                                                    <p style="margin-left: 20px;">${censorBadWords(comment.text)}</p>
                                                    
                                                </div>
                                            `;
                                        }).join('') 
                                        : '<p style="margin-left: 20px; color: #666;">No hay comentarios aún.</p>'
                                    }
                                </div>
                                
                                <!-- Formulario para agregar comentario -->
                                <div class="add-comment-form" style="margin-top: 10px;">
                                    <textarea id="comment-text-${r._id}" placeholder="Escribe un comentario..." rows="2" style="width: 100%; margin-bottom: 5px;"></textarea>
                                    <button class="add-comment-btn" data-review-id="${r._id}" style="background: #007bff; color: white; border: none; padding: 5px 10px; cursor: pointer;">Agregar Comentario</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            `;
        }

        if (bookDetailsContainer) bookDetailsContainer.appendChild(reviewsContainer);
        
        // Agregar event listeners para los botones de comentarios
        setupCommentEventListeners();

    } catch (error) {
        console.error('Error al cargar reseñas:', error);
        reviewsContainer.innerHTML = '<p>Error al cargar reseñas.</p>';
        if (bookDetailsContainer) bookDetailsContainer.appendChild(reviewsContainer);
    }
}

// Función para configurar los event listeners de comentarios
function setupCommentEventListeners() {
    // Event listeners para agregar comentarios
    document.querySelectorAll('.add-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const reviewId = e.target.dataset.reviewId;
            const textArea = document.getElementById(`comment-text-${reviewId}`);
            const commentText = textArea.value.trim();
            
            if (!commentText) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Comentario vacío',
                    text: 'Por favor escribe un comentario antes de enviarlo.',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
                return;
            }

            const userInfo = JSON.parse(sessionStorage.getItem('user'));
            if (!userInfo || !userInfo.name) {
                Swal.fire({
                    icon: 'error',
                    title: 'Sesión requerida',
                    text: 'Debes iniciar sesión para comentar.',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false
                });
                return;
            }

            try {
                const response = await fetch(`${window.location.origin}/api/reviews/${reviewId}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user: userInfo.name,
                        text: commentText
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al agregar comentario');
                }

                // Limpiar el textarea
                textArea.value = '';
                
                // Recargar las reseñas para mostrar el nuevo comentario
                const bookId = getBookId();
                await fetchAndRenderReviews(bookId);

                Swal.fire({
                    icon: 'success',
                    title: 'Comentario agregado',
                    text: 'Tu comentario ha sido publicado exitosamente.',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });

            } catch (error) {
                console.error('Error al agregar comentario:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'No se pudo agregar el comentario.',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Event listeners para eliminar comentarios
    document.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const reviewId = e.target.dataset.reviewId;
            const commentId = e.target.dataset.commentId;

            const result = await Swal.fire({
                title: '¿Estás seguro?',
                text: 'Esta acción no se puede deshacer.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                try {
                    const response = await fetch(`${window.location.origin}/api/reviews/${reviewId}/comments/${commentId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Error al eliminar comentario');
                    }

                    // Recargar las reseñas para mostrar los cambios
                    const bookId = getBookId();
                    await fetchAndRenderReviews(bookId);

                    Swal.fire({
                        icon: 'success',
                        title: 'Comentario eliminado',
                        text: 'El comentario ha sido eliminado exitosamente.',
                        toast: true,
                        position: 'top-end',
                        timer: 2000,
                        showConfirmButton: false
                    });

                } catch (error) {
                    console.error('Error al eliminar comentario:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'No se pudo eliminar el comentario.',
                        toast: true,
                        position: 'top-end',
                        timer: 3000,
                        showConfirmButton: false
                    });
                }
            }
        });
    });
}

// Obtiene el ID del libro de la URL
function getBookId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// Maneja el submit del formulario
document.getElementById('review-form').addEventListener('submit', async e => {
  e.preventDefault();

  const userInfo = JSON.parse(sessionStorage.getItem('user'));
  if (!userInfo || !userInfo.name) {
    showError('Debes iniciar sesión para publicar una reseña.');
    return;
  }

  const bookId = getBookId();
  const rating = parseInt(document.getElementById('review-rating').value, 10);
  const text   = document.getElementById('review-text').value.trim();

  if (!rating || !text) {
    showError('Por favor, deja un comentario y una calificación.');
    return;
  }

  const payload = {
    libro: bookId,
    user: userInfo.name,
    rating,
    text
  };

  try {
    const res = await fetch(`${window.location.origin}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
      showError(result.message || 'No se pudo enviar la reseña. Intenta de nuevo.');
      return;
    }

    document.getElementById('review-form').reset();
    await fetchAndRenderReviews(bookId);
  } catch (err) {
    console.error(err);
    showError('No se pudo enviar la reseña. Intenta de nuevo.');
  }
});

function showError(message) {
  const errorElement = document.getElementById("review-error");

  // Asegúrate de que el contenedor esté visible
  const formSection = document.getElementById("review-form-section");
  if (formSection.style.display === "none") {
    formSection.style.display = "block";
  }

  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
  } else {
    console.warn("Elemento #review-error no encontrado.");
  }
}

// Ejecutar la función para cargar y renderizar los detalles del libro cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', fetchAndRenderBookDetails);

// Evento para el botón de ir al carrito (asumiendo que existe un elemento con clase 'cart-btn' en el HTML)
const cartButton = document.querySelector('.cart-btn');
if (cartButton) {
     cartButton.addEventListener('click', function() {
        // Asegúrate de que la ruta a carrito.html sea correcta
        window.location.href = "./carrito.html";
    });
}

  // *** Recordatorio sobre CartManager ***
  // Asegúrate de que tu archivo public/CartManager.js maneje la lógica de carga y guardado
  // del carrito en localStorage (o interactúe con tu backend si el carrito es server-side).
  // Los métodos addItem, removeItem, etc., DEBEN llamar a un método de guardado interno.
  // Ejemplo conceptual de saveCart en CartManager:
  //     localStorage.setItem('cart', JSON.stringify(this.cart));
  // }
  // Ejemplo conceptual de loadCart en CartManager constructor:
  // constructor() {
  //     const savedCart = localStorage.getItem('cart');
  //     this.cart = savedCart ? JSON.parse(savedCart) : [];
  // }
