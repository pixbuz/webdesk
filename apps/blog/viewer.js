const content = document.getElementById('blog-content')
const toc = document.getElementById('toc')
const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6')

const observer = new IntersectionObserver((entries) => {
	entries.forEach(entry => {
		if (entry.isIntersecting) {
			document.querySelectorAll('.toc a').forEach((a) => { a.classList.remove('active') })
			
			const activeLink = document.querySelector(`.toc a[href="#${entry.target.id}"]`)
			if (activeLink) activeLink.classList.add('active')
		}
	})
}, { rootMargin: '0px 0px -80% 0px' })

headings.forEach((heading, index) => {
	if (!heading.id) {
		const safeText = heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-')
		heading.id = `${safeText}-${index}`
	}

	const level = parseInt(heading.tagName.substring(1))

	const link = document.createElement('a')
	link.href = `#${heading.id}`
	link.title = heading.textContent
	link.textContent = heading.textContent

	link.style.marginLeft = `${level}rem`

	toc.appendChild(link)
	observer.observe(heading)
})