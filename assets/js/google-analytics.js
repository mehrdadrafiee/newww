$(document).ready(function () {
  $('.hiring a').click(function (e) {
    var id = $(this).parent().data('id')
    ga('send', 'event', 'Hiring Ads', 'click', id)
  })

  $('.npme-group a, .npme-details a').click(function (e) {
    ga('send', 'event', 'npm Enterprise', 'click')
  })

})